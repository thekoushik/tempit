const availableCommands=require('./commands');
const availableOptions=require('./options');
const packageJSON=require('../package.json');

const getOptions=exports.getOptions=(array)=>{
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
const runCommand=exports.runCommand=(cmd,options,args)=>{
    if(cmd && availableCommands[cmd])
        availableCommands[cmd].fn(options,args);
    else{
        if(options.version) console.log(packageJSON.version);
        else runCommand("help",options,args);
    }
}
exports.run=(input_array)=>{
    try{
        var {options,command,args}=getOptions(input_array);
        runCommand(command,options,args);
    }catch(e){
        console.log("Error: "+e.message);
    }
}
var makeCommandHelp=(cmd)=>cmd.map(function(a){return '['+a.name+']'+(a.rest?'...':'')}).join(" ")
exports.help=(args)=>{
    var optionHelp={};
    Object.keys(availableOptions).forEach((a)=>{
        if(availableOptions[a].alias)
            optionHelp[availableOptions[a].alias]="-"+a+"|--"+availableOptions[a].alias+"\t"+availableOptions[availableOptions[a].alias].description;
        else if(availableOptions[a].description && !optionHelp[a])
            optionHelp[a]="-"+a+"\t"+availableOptions[a].description;
        else if(!optionHelp[a])
            optionHelp[a]="--"+a+"\t"+availableOptions[a].description;
    })
    if(!args.length){
    return `${packageJSON.name} v${packageJSON.version}
Usage:\n\t${packageJSON.name} [COMMAND] [OPTIONS] [ARGUMENTS]
Commands:\n\t${Object.keys(availableCommands).map(a=>a+"\t"+availableCommands[a].description).join("\n\t")}
Options:\n\t${Object.keys(optionHelp).map(a=>optionHelp[a]).join("\n\t")}

Run
\t${packageJSON.name} help [COMMAND]
for command specific help
`;
    }else{
        var cmd=args[0];
        if(!availableCommands[cmd]) return `Command ${cmd} not supported`;
        var commandArgs=availableCommands[cmd].arguments || [];
        var allowedOptions=availableCommands[cmd].allowedOptions || [];
        var allCommands=[`${packageJSON.name} ${cmd} ${makeCommandHelp(commandArgs)}`];
        if(commandArgs.length || allowedOptions.length)
            allCommands[0]+=`\n\t\t${availableCommands[cmd].description}`;
        commandArgs.forEach(function(a,i){
            if(a.default){
                allCommands.push(`${packageJSON.name} ${cmd} ${makeCommandHelp(commandArgs.slice(i+1))}\n\t\t${a.default} will be assumed as [${a.name}]`);
            }
        })
        var helpStr='';
        if(!commandArgs.length && !allowedOptions.length)
            helpStr+=`${availableCommands[cmd].description}\n`;
        helpStr+=`
Usage:
\t${allCommands.join('\n\t')}`;
        if(allowedOptions.length)
            helpStr+=`\nOPTIONS:
\t${allowedOptions.map(function(a){return optionHelp[a]}).join("\n\t")}
`;
        return helpStr;
    }
}