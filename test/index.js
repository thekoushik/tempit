var expect=require('chai').expect;
var process=require('process');
var utils=require('../lib/utils');

describe('utils test',()=>{
    it('#1 getGitIgnoredFileList should ignore .git folder',()=>{
        var list=utils.getGitIgnoredFiles(process.cwd());
        expect(list.some((a)=>a.startsWith(".git/"))).to.be.false
    })
    it('#2 getGitIgnoredFileList should ignore .md files',()=>{
        var list=utils.getGitIgnoredFiles(process.cwd(),"*.md");
        expect(list.some((a)=>a.endsWith(".md"))).to.be.false
    })
    it('#3 ls should have README.md file',()=>{
        var list=utils.ls("");
        expect(list.some((a)=>a.name=="README.md")).to.be.true
    })
});