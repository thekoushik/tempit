#!/usr/bin/env node

var request=require('superagent');
var getmac=require('getmac');
var readline = require('readline-sync');
var isReachable = require('is-reachable');
var chalk = require('chalk');
var os = require('os');
var path = require('path');
var fs = require('fs');
var tmp = require('tmp');
var ProgressBar = require('progress');
var https = require('https');
var fstream=require('fstream');
var tar=require('tar');
var zlib=require('zlib');

var host="tempit-thekoushik.rhcloud.com";
var website="https://"+host;
var commands=['set','reset','up','down',"help"];
var command=process.argv[2]?process.argv[2].toLowerCase():"";
var command2=process.argv[3];

if(command=="" || command=="help"){
    console.log([
        "",
        "Usage: tempit <command>",
        "",
        "where <command> is one of:",
        "    set, reset, up, down, help",
        "",
        "tempit set [name]   add this machine to your tempit account (Login required)",
        "tempit reset        remove this machine from your tempit account",
        "tempit up           upload the content of current directory",
        "tempit down         download previous upload to current directory",
        "tempit help         view this help",
        "",
        "To use this app, signup to TempIt. Previous upload is discarded upon upload."
    ].join("\n"));
}else if(commands.indexOf(command)<0){
    console.log("Invalid command, try: tempit help");
}else{
    process.stdout.write("Initializing....(Please Wait)");
    getmac.getMac(function(e,mac){
        if(e){
            process.stdout.write("\r\x1b[K");
            throw e;
        }
        isReachable(website).then(function(reachable){
            process.stdout.write("\r\x1b[K");
            if(!reachable){
                console.log(chalk.red("Server is unreachable right now, please check your internet connection or try again later."));
                return;
            }
            if(command=='set'){
                var email=readline.question('Email:');
                var pass=readline.question('Password:',{hideEchoBack: true});
                if(command2==undefined) command2="";
                process.stdout.write("Verifying....(Please Wait)");
                request.post(website+"/setmac.php")
                .type('form')
                .send({type:'set'})
                .send({email:email})
                .send({password:pass})
                .send({address:mac})
                .send({name:command2})
                .end(function(e,res){
                    process.stdout.write("\r\x1b[K");
                    //console.log(res.text);
                    if(res.text=="-1"){
                        console.log(chalk.red("Authentication Failed -","Wrong Credentials!"));
                    }else if(res.text=="1"){
                        console.log(chalk.green("Success"));
                    }else{
                        console.log(chalk.red("Internal Server Error :("));
                    }
                });
            }else if(command=='reset'){
                process.stdout.write("Verifying....(Please Wait)");
                request.post(website+"/setmac.php")
                .type('form')
                .send({type:'reset'})
                .send({address:mac})
                .end(function(e,res){
                    process.stdout.write("\r\x1b[K");
                    //console.log(res.text);
                    if(res.text=="1"){
                        console.log(chalk.green("Success"));
                    }else{
                        console.log(chalk.red("Internal Server Error :("));
                    }
                });
            }else if(command=='up'){
                process.stdout.write("Archiving....(Please Wait)");
                var tmpobj = tmp.fileSync();
                //var filename="target.tar.gz";
                var source=tmpobj.name;
                
                fstream.Reader({ 'path': process.cwd(), 'type': 'Directory' })
                .pipe(tar.Pack({ fromBase: true }))
                .pipe(zlib.Gzip()
                    .on('end', function() {

                        process.stdout.write("\r\x1b[K");
                        //process.stdout.write("Sending....(Please Wait)");
                        var len=fs.statSync(source)["size"];
                        if(len>=10*1024*1024){
                            console.log(chalk.red("Max size exceeded!(upto 10MB)"));
                            fs.unlink(source);
                            return;
                        }
                        var bar = new ProgressBar('  uploading [:bar] :percent :etas', {complete: '=',incomplete: ' ',width: 20,total: len,clear:true});
                        request.post(website+"/upload.php")
                        .field('type','up')
                        .field('address',mac)
                        .attach('file', source)
                        .on('progress',function(event){
                            //var total = event.total;
                            //var loaded = event.loaded;
                            bar.update(event.loaded/event.total);
                        })
                        .on('error',function(e){
                            fs.unlink(source);
                            console.log("error",e);
                        })
                        .end(function(e,res){
                            if(res.text=="0")
                                console.log(chalk.red("Upload failed"));
                            else
                                console.log(chalk.green("Complete"));
                            fs.unlink(source);
                        });
                    })
                )
                .pipe(fs.createWriteStream(source,{fd:tmpobj.fd}));
                
            }else if(command=='down'){
                process.stdout.write("Verifying....(Please Wait)");
                var tmpobj = tmp.fileSync();
                var source=tmpobj.name;
                var output = fs.createWriteStream(source,{fd:tmpobj.fd});
                request.post(website+"/upload.php")
                .type('form')
                .send({type:'down'})
                .send({address:mac})
                .end(function(e,res){
                    process.stdout.write("\r\x1b[K");
                    if(res.text=="-1"){
                        console.log(chalk.red("This machine is not recognised to the server."));
                        return;
                    }else if(res.text==""){
                        console.log(chalk.red("No previous upload found."));
                        return;
                    }
                    process.stdout.write("Allocating....(Please Wait)");
                    var req = https.request({hostname: host,path: "/"+res.text});
                    req.on('response', function(res){
                        var len = parseInt(res.headers['content-length'], 10);
                        process.stdout.write("\r\x1b[K");
                        var bar = new ProgressBar('  downloading [:bar] :percent :etas', {complete: '=',incomplete: ' ',width: 20,total: len,clear:true});
                        res.on('data', function (chunk) {
                            output.write(chunk);
                            bar.tick(chunk.length);
                        })
                        .on('error', function (e) {console.log(e);})
                        .on('end', function () {
                            output.end();
                            process.stdout.write("Extracting....(Please Wait)");
                            fs.createReadStream(source)
                            .pipe(zlib.createGunzip())
                            .pipe(tar.Extract({path: process.cwd()})
                                .on('error', function(){console.log(e);})
                                .on('end', function(){
                                    fs.unlink(source);
                                    process.stdout.write("\r\x1b[K");
                                    console.log(chalk.green("Complete"));
                                })
                            );
                        });
                    });
                    req.end();
                });
            }
        });
    });
}