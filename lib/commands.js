const fs = require('fs');
const process=require('process');
const path=require('path');
const TEMPITFILE=".tempit";
const MYPORT=55555;
var readline = require('readline-sync');
var tmp = require('tmp');
const net = require('net');
var tar=require('tar');
const CLI=require('./cli');
var tempitUtils=require('./utils');

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

var currentConf=getTempit();
const currentDirectory=process.cwd();
var freshConf={
    name: currentDirectory.split(path.sep).pop(),
    version: "0.0.1",
    description: "Your project description",
    modules:{},
    port:MYPORT
};

//except files/patterns
var zipit=(opt,cb)=>{
    var target_directory=process.cwd();
    var source=tmp.tmpNameSync({postfix:".tgz"});
    var files=[];
    if(!opt.module){//opt.except
        if(opt.except)
            files=tempitUtils.getGitIgnoredFiles(target_directory,opt.files);
        else
            files=opt.files;
    }else{
        if(!opt.mod_name)
            files=tempitUtils.getGitIgnoredFiles(target_directory);
        else if(!currentConf.modules[opt.mod_name])
            return console.log("Module "+opt.mod_name+" not found");
        else
            files=currentConf.modules[opt.mod_name].files.length>0?currentConf.modules[opt.mod_name].files:tempitUtils.getGitIgnoredFiles(target_directory);
    }
    tar.c({ z: true, C: target_directory, file: source}, files, (_)=>{
        if(cb) cb(source,_=>fs.unlinkSync(source));
        else fs.unlinkSync(source)
    })
};
var unzipit=(filename,target_directory)=> tar.x({ C: target_directory,keep:false,file:filename },_=>fs.unlinkSync(filename));

var fetchFrom=(port,ip,payload)=>{
    var client = new net.Socket();
    client.connect(port, ip, function() {
        console.log('Connected to server');
        client.write(JSON.stringify(payload));
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

module.exports={
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
        fn:(options,args)=>{
            console.log(CLI.help(args));
        }
    },
    "add":{
        arguments:[
            {
                name: "module name"
            },{
                name: "files or folders",
                rest:true
            }
        ],
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
                            zipit({module:true,mod_name:mod},(source,done)=>{
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
                            console.log("Client requesting file(s)",reqObj.e?"except":"",mod);
                            var files=mod.length?tempitUtils.getPatternedFiles(process.cwd(),mod):tempitUtils.getGitIgnoredFiles(process.cwd());
                            files.forEach(m=>fs.accessSync(m,fs.constants.F_OK))
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.nextData}));
                            zipit({files:files,module:false,except:reqObj.e},(source,done)=>{
                                var s=fs.createReadStream(source);
                                s.on('open',_=>s.pipe(c))
                                s.on('finish',_=>{
                                    done();
                                    c.end();
                                });
                            })
                        }catch(e){
                            console.log("Error:",e)
                            c.write(JSON.stringify({t:TEMPIT_RESPONSE.invalidPath}));
                        }
                    }else if(reqObj.t==TEMPIT_REQUEST.ls){
                        var mod=reqObj.m;
                        try{
                            var list=tempitUtils.ls(mod);
                            if(!list)
                                c.write(JSON.stringify({t:TEMPIT_RESPONSE.notDirectory}));
                            else
                                c.write(JSON.stringify({t:TEMPIT_RESPONSE.ok,d:list}));
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
                console.log('tempit server is live');
            });
        }
    },
    "fetch":{
        description:"Fetch module from remote tempit server",
        fn:(options,args)=>{
            var ip=args[0] || "localhost";
            var mod=args[1] || "";
            var port=(currentConf && currentConf.port) || MYPORT;
            fetchFrom(port,ip,{t:TEMPIT_REQUEST.moduleFetch,m:mod});
        }
    },
    "ls":{
        arguments:[
            {
                name: "server address",
                default: "localhost"
            },{
                name: "foldername",
                default: "current directory"
            }
        ],
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
                    console.log(tempitUtils.prittyLS(resObj.d));
                else
                    console.log(TEMPIT_RESPONSE_TEXT[resObj.t]);
            });
        }
    },
    "cp":{
        arguments:[
            {
                name: "server address",
                default: "localhost"
            },{
                name: "files and folders",
                default: "all files and folders",
                rest: true
            }
        ],
        allowedOptions:["except"],
        description: "Copy files or directory from remote tempit server(No module required)",
        fn:(options,args)=>{
            var ip=args[0] || "localhost";
            var port=(currentConf && currentConf.port) || MYPORT;
            var mod=(args.length>1)?args.slice(1):[];
            fetchFrom(port,ip,{t:TEMPIT_REQUEST.pathFetch,m:mod,e:options.except});
        }
    }
};