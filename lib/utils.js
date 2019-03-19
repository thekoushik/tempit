var walk=require('ignore-walk');
var minimatch=require('minimatch');
var fs=require('fs');
var path=require('path');
var filesize=require('filesize');
var glob=require('glob');

exports.getGitIgnoredFiles=(dir,except)=>{
    var walker=new walk.WalkerSync({
        path:dir || process.cwd(),
        ignoreFiles:[".gitignore",'.tempitignore']
    });
    walker.ignoreRules['.tempitignore']=[
        new minimatch.Minimatch('.git/*',{matchBase: true,dot: true,flipNegate: true,nocase: true})
    ];
    if(except){
        (Array.isArray(except)?except:[except]).forEach(ex=>{
            walker.ignoreRules['.tempitignore'].push(new minimatch.Minimatch(ex,{
                matchBase: true,nocase: true//,dot: true,flipNegate: true,
            }))
        })
    }
    return walker.start().result;
}
exports.getPatternedFiles=(dir, patterns)=>{
    var result=[];
    patterns.forEach(pat=>{
        result=result.concat(glob.sync(pat,{cwd:dir}))
    });
    return result;
}
var strPadding=(s,len,suffix)=>{
    var padding="";
    if(s.length<len) padding=Array.apply(null,{length:len-s.length}).map(a=>" ").join("");
    return suffix? s+padding:padding+s;
}
var maxLengthOfPropInArray=(array,prop)=>array.reduce((a,c)=>(a<c[prop].length)?c[prop].length:a,0)
exports.prittyLS=(ls)=>{
    var maxSizeLen=maxLengthOfPropInArray(ls,'size');
    return ls.map(a=>`${a.type} ${strPadding(a.type=='F'?a.size:'',maxSizeLen,true)} ${a.name}\t`).join('\n')
}
exports.ls=(directory)=>{
    var dir=directory || ".";
    dir=dir.startsWith("/")?"."+dir:dir;
    try{
        fs.accessSync(dir,fs.constants.F_OK);
        var stat=fs.statSync(dir);
        if(!stat.isDirectory()) return false;
        return fs.readdirSync(dir).map(function(a){
            var st=fs.statSync(path.resolve(dir,a));
            return {
                name: a,
                type: st.isDirectory()?"D":"F",
                size: filesize(st.size)
            };
        });
    }catch(e){
        throw new Error("Directory "+dir+" not found");
    }
}