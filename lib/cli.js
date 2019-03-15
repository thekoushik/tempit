const availableCommands=require('./commands');
const availableOptions=require('./options');

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
        if(options.version) console.log(VERSION);
        else runCommand("help",options,args);
    }
}
exports.run=(input_array)=>{
    var {options,command,args}=getOptions(input_array);
    runCommand(command,options,args);
}
exports.help=(packagejson)=>{
    var optionHelp={};
    Object.keys(availableOptions).forEach((a)=>{
        if(availableOptions[a].alias)
            optionHelp[availableOptions[a].alias]="-"+a+"|--"+availableOptions[a].alias+"\t"+availableOptions[availableOptions[a].alias].description;
        else if(availableOptions[a].description && !optionHelp[a])
            optionHelp[a]="-"+a+"\t"+availableOptions[a].description;
        else if(!optionHelp[a])
            optionHelp[a]="--"+a+"\t"+availableOptions[a].description;
    })
    return `${packagejson.name} v${packagejson.version}
Usage:\n\t${packagejson.name} [COMMAND] [OPTIONS] [ARGUMENTS]
Commands:\n\t${Object.keys(availableCommands).map(a=>a+"\t"+availableCommands[a].description).join("\n\t")}
Options:\n\t${Object.keys(optionHelp).map(a=>optionHelp[a]).join("\n\t")}
`;
}