#!/usr/bin/env node

const fs = require('fs');
const process=require('process');
const path=require('path');
const TEMPITFILE=".tempit";
const VERSION=require('./package.json').version;
const MYPORT=55555;
var readline = require('readline-sync');
var tmp = require('tmp');
const net = require('net');
var tar=require('tar');
var walk=require('ignore-walk');

const TEMPIT_REQUEST={
    moduleFetch:"FETCH",
    pathFetch:"CFETCH",
    ls:"LS"
};
const TEMPIT_RESPONSE={
    ok:"OK",
    nextData:"DATA_NEXT",
    invalidModule:"INV_MOD",
    invalidPath:"INV_PATH",
    notDirectory:"INV_DIR",
    invalidType:"INV_TYPE",
}
const TEMPIT_RESPONSE_TEXT={
    OK:"Success",
    DATA_NEXT:"Incoming data..",
    INV_MOD:"Module not found",
    INV_PATH:"Path not found",
    INV_TYPE:"Invalid type",
    INV_DIR:"Not a directory",
}

const getTempit=()=>{
    try{
        fs.accessSync(TEMPITFILE,fs.constants.F_OK|fs.constants.R_OK)
        try{
            return JSON.parse(fs.readFileSync(TEMPITFILE,'utf8'));
        }catch(e){
            console.log(e)
            throw new Error("Corrupted tempit file encountered.");
        }
    }catch(e){
        return null;
    }
}
const putTempit=(data)=>{
    if(!currentConf) currentConf=Object.assign({},data);
    if(data) currentConf=Object.assign(currentConf,data);
    try{
        fs.writeFileSync(TEMPITFILE,JSON.stringify(currentConf,null,2), 'utf8');
    }catch(e){
        console.log(e);
        throw new Error("Cannot write modify tempit config");
    }
}
const getOptions=(array)=>{
    var options={};
    var command=null;
    var args=[];
    array.forEach((item)=>{
        if(item.startsWith("-") && item.length==2 && !item.endsWith("-")){
            var op=item.substr(1);
            if(options[op])
                throw new Error("Multiple "+item+" option specified");
            if(!availableOptions[op])
                throw new Error("Invalid option "+item);
            options[op]=true;
            if(availableOptions[op].alias)
                options[availableOptions[op].alias]=true;
        }else if(item.startsWith("--") && item.length>2 && !item.startsWith("---")){
            var op=item.substr(2);
            if(options[op])
                throw new Error("Multiple "+item+" option specified");
            if(!availableOptions[op])
                throw new Error("Invalid option "+item);
            options[op]=true;
        }else{
            if(!command){
                if(!availableCommands[item])
                    throw new Error("Invalid command "+item);
                command=item;
            }else
                args.push(item);
        }
    })
    return {options,command,args};
}

const run=(cmd,options,args)=>{
    if(cmd && availableCommands[cmd])
        availableCommands[cmd].fn(options,args);
    else{
        if(options.version) console.log(VERSION);
        else run("help",options,args);
    }
}
var currentConf=getTempit();
const currentDirectory=process.cwd();
var freshConf={
    name: currentDirectory.split(path.sep).pop(),
    version: "0.0.1",
    description: "Your project description",
    modules:{},
    port:MYPORT
};

var getGitIgnoredFileList=(dir)=>{
    var files=walk.sync({path:dir || process.cwd(),ignoreFiles:[".gitignore"]}).filter(a=>!a.startsWith(".git/"));
    return files;
}

var zipit=(mod,isDirect,cb)=>{
    var target_directory=process.cwd();
    var source=tmp.tmpNameSync({postfix:".tgz"});
    var files=[];
    if(isDirect){
        files.push(mod);
    }else{
        if(!mod)
            files=getGitIgnoredFileList(target_directory);
        else if(!currentConf.modules[mod])
            return console.log("Module "+mod+" not found");
        else
            files=currentConf.modules[mod].files.length>0?currentConf.modules[mod].files:getGitIgnoredFileList(target_directory);
    }
    tar.c({ z: true, C: target_directory, file: source}, files, (_)=>{
        if(cb) cb(source,_=>fs.unlinkSync(source));
        else fs.unlinkSync(source)
    })
};
var unzipit=(filename,target_directory)=> tar.x({ C: target_directory,keep:false,file:filename },_=>fs.unlinkSync(filename));

var fetchFrom=(port,ip,type,mod)=>{
    var client = new net.Socket();
    client.connect(port, ip, function() {
        console.log('Connected to server');
        client.write(JSON.stringify({t:type,m:mod}));
    });
    client.on('error', function(err) {
        if(err.code=='ECONNREFUSED')
            console.log("Cannot connect to tempit server at "+ip+":"+port+", make sure tempit server is running before fetch");
        else
            console.log(err);
    });
    var data_next=null;
    var dest=null;
    client.on('data', function(data) {
        if(!data_next){
            var resObj=JSON.parse(data.toString('utf8'));
            if(resObj.t==TEMPIT_RESPONSE.nextData){
                data_next=tmp.tmpNameSync({postfix:".tgz"});
                dest=fs.createWriteStream(data_next);
                dest.on('error', function(err) {
                    client.end();
                    console.log(err);
                });
            }else{
                console.log('Server: ', TEMPIT_RESPONSE_TEXT[resObj.t]);
                client.end()
            }
        }else{
            console.log("Receiving..",data.byteLength+" bytes");
            dest.write(data);
        }
    });
    client.on('close', function() {
        console.log('Connection closed');
        if(data_next){
            dest=null;
            unzipit(data_next,process.cwd())
        }
    });
}

const availableCommands={
    "init":{
        description:"Initializes the project settings",
        fn:(options,args)=>{
            var doInit=()=>{
                try{
                    fs.accessSync("package.json",fs.constants.F_OK)
                    var packageJSON=JSON.parse(fs.readFileSync("package.json",'utf8'))
                    freshConf.name=packageJSON.name;
                    freshConf.description=packageJSON.description;
                    freshConf.version=packageJSON.version;
                }catch(e){
                    try{
                        fs.accessSync("composer.json",fs.constants.F_OK)
                        var composerJSON=JSON.parse(fs.readFileSync("composer.json",'utf8'))
                        freshConf.name=composerJSON.name;
                        freshConf.description=composerJSON.description;
                    }catch(e){
                    }
                }
                putTempit(freshConf);
                console.log("Init successfully");
            };
            if(!currentConf)
                doInit();
            else{
                var v=readline.question("Already initialized. Reinitialize?(y/n) ");
                if(v.toLowerCase().startsWith("y")){
                    doInit();
                }
            }
        }
    },
    "help":{
        description:"Displays this help",
        fn:()=>{
            console.log("Tempit v"+VERSION);
            console.log("Usage:\n\ttempit [COMMAND] [OPTIONS] [ARGUMENTS]");
            console.log("\nCommands:\n\t"+Object.keys(availableCommands).map(a=>a+"\t"+availableCommands[a].description).join("\n\t"));
            var optionHelp={};
            Object.keys(availableOptions).forEach((a)=>{
                if(availableOptions[a].alias)
                    optionHelp[availableOptions[a].alias]="-"+a+"|--"+availableOptions[a].alias+"\t"+availableOptions[availableOptions[a].alias].description;
                else if(availableOptions[a].description && !optionHelp[a])
                    optionHelp[a]="-"+a+"\t"+availableOptions[a].description;
                else if(!optionHelp[a])
                    optionHelp[a]="--"+a+"\t"+availableOptions[a].description;
            })
            console.log("\nOptions:\n\t"+Object.keys(optionHelp).map(a=>optionHelp[a]).join("\n\t"));
        }
    },
    "add":{
        description: "Add module to config",
        fn:(options,args)=>{
            if(args.length>=2){
                var _files=args.slice(1);
                var files=_files.filter((a)=>{
                    try{
                        fs.accessSync(a,fs.constants.F_OK);
                        return true;
                    }catch(e){
                        console.log(a+" does not exist");
                    }
                });
                if(files.length!=_files.length) return;
                if(currentConf.modules[args[0]])
                    currentConf.modules[args[0]].files=currentConf.modules[args[0]].files.concat(files);
                else
                    currentConf.modules[args[0]]={
                        name: args[0],
                        files:files,
                        dependencies:[]
                    };
                putTempit();
                console.log(" + "+args[0]+"\t"+files);
            }else
                console.log("add command needs atleast 2 arguments")
        }
    },
    "start":{
        description:"Start Tempit server",
        fn:(options,args)=>{
            var server=net.createServer((c)=>{
                console.log('client connected');
                c.on('end', () => {
                    console.log('client disconnected');
                });
                c.on('data', (data)=>{
                    var reqObj = JSON.parse(data.toString('utf8'));
                    if(reqObj.t==TEMPIT_REQUEST.moduleFetch){
                        var mod=reqObj.m;
                        if(mod.length>0 && !currentConf.modules[mod])
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.invalidModule}));
                        else{
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.nextData}));
                            zipit(mod,false,(source,done)=>{
                                var s=fs.createReadStream(source);
                                s.on('open',_=>s.pipe(c))
                                s.on('finish',_=>{
                                    done()
                                    c.end();
                                });
                            })
                        }
                    }else if(reqObj.t==TEMPIT_REQUEST.pathFetch){
                        var mod=reqObj.m;
                        try{
                            console.log("Client requesting file(s):",mod);
                            fs.accessSync(mod,fs.constants.F_OK);
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.nextData}));
                            zipit(mod,true,(source,done)=>{
                                var s=fs.createReadStream(source);
                                s.on('open',_=>s.pipe(c))
                                s.on('finish',_=>{
                                    done();
                                    c.end();
                                });
                            })
                        }catch(e){
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.invalidPath}));
                        }
                    }else if(reqObj.t==TEMPIT_REQUEST.ls){
                        var mod=reqObj.m;
                        if(mod.startsWith("/")) mod="./"+mod;
                        try{
                            fs.accessSync(mod,fs.constants.F_OK);
                            var stat=fs.statSync(mod);
                            if(!stat.isDirectory()){
                                c.write(JSON.stringify({t:TEMPIT_RESPONSE.notDirectory}));
                            }else{
                                var list=fs.readdirSync(mod).map(function(a){
                                    var st=fs.statSync(path.resolve(mod,a));
                                    return {
                                        name: a,
                                        type: st.isDirectory()?"D":"F",
                                        size: st.size
                                    };
                                });
                                c.write(JSON.stringify({t:TEMPIT_RESPONSE.ok,d:list}));
                            }
                        }catch(e){
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.invalidPath}));
                        }
                        c.end();
                    }else
                        c.write(JSON.stringify({t:TEMPIT_RESPONSE.invalidType}));
                });
                c.on('error',(err)=>{
                    console.log(err);
                })
            });
            server.on('error', (err) => {
                throw err;
            });
            var port=args[0] || (currentConf && currentConf.port) || MYPORT;
            server.listen(port, () => {
                console.log('tempit server is ready on',port);
            });
        }
    },
    "fetch":{
        description:"Fetch module from remote tempit server",
        fn:(options,args)=>{
            var ip=args[0] || "localhost";
            var mod=args[1] || "";
            var port=(currentConf && currentConf.port) || MYPORT;
            fetchFrom(port,ip,TEMPIT_REQUEST.moduleFetch,mod);
        }
    },
    "ls":{
        description: "Directory and files listing in tempit server",
        fn:(options,args)=>{
            var ip=args[0] || "localhost";
            var mod=args[1] || ".";
            var port=(currentConf && currentConf.port) || MYPORT;
            var client = new net.Socket();
            client.connect(port, ip, function() {
                console.log('Connected to server');
                client.write(JSON.stringify({t:TEMPIT_REQUEST.ls,m:mod}));
            });
            client.on('error', function(err) {
                if(err.code=='ECONNREFUSED')
                    console.log("Cannot connect to tempit server at "+ip+":"+port+", make sure tempit server is running before fetch");
                else
                    console.log(err);
            });
            client.on('data', function(data) {
                var resObj=JSON.parse(data.toString('utf8'));
                if(resObj.t==TEMPIT_RESPONSE.ok)
                    console.log(resObj.d.map(function(a){
                        if(a.type=="D") return "D "+a.name;
                        return "F "+a.name+"\t"+a.size;
                    }).join('\n'));
                else
                    console.log(TEMPIT_RESPONSE_TEXT[resObj.t]);
            });
        }
    },
    "cp":{
        description: "Copy files or directory from remote tempit server(No module required)",
        fn:(options,args)=>{
            var ip=args[0] || "localhost";
            var mod=args[1] || "";
            var port=(currentConf && currentConf.port) || MYPORT;
            fetchFrom(port,ip,TEMPIT_REQUEST.pathFetch,mod);
        }
    }
}

const availableOptions={
    "v":{//-v
        alias: "version"
    },
    "version":{//--version
        description: "Displays version"
    }
}
var {options,command,args}=getOptions(process.argv.slice(2));
run(command,options,args);