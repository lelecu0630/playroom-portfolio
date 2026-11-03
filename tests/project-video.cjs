const fs=require('fs'),vm=require('vm'),assert=require('assert');
function element(tag){return {tag,children:[],className:'',append(...children){this.children.push(...children)},setAttribute(){},replaceChildren(...children){this.children=children},addEventListener(){},play(){return Promise.resolve()}}}
const context={URL,document:{createElement:element,head:{append(){}}}};vm.createContext(context);vm.runInContext(fs.readFileSync('projects.js','utf8'),context);
assert.equal(context.projectVideoUrl('javascript:alert(1)'),null);assert.equal(context.projectVideoUrl('http://example.com/game.mp4'),null);assert.equal(context.projectVideoUrl('https://example.com/game.mp4?v=2'),'https://example.com/game.mp4?v=2');
let media=context.projectMedia({repo:'fishing',name:'낚시게임',emoji:'🎣'});assert(media.children[0].disabled);assert.equal(media.children[0].children[1].textContent,'소개 영상 준비 중');
media=context.projectMedia({repo:'fishing',name:'낚시게임',emoji:'🎣',video:'https://example.com/game.webm'});assert(!media.children[0].disabled);media.children[0].onclick();assert.equal(media.children[0].tag,'video');assert(media.children[0].controls);assert.equal(media.children[0].src,'https://example.com/game.webm');
console.log('PASS: safe video URLs, no-video state, click-to-play video with controls');
for(const [link,id] of [['https://youtu.be/-Y1ZCEGyL7k','-Y1ZCEGyL7k'],['https://www.youtube.com/watch?v=wYvvs9OY7ZY','wYvvs9OY7ZY']]){
 const area=context.projectMedia({repo:'return-night-download',name:'게임',video:link});area.children[0].onclick();
 assert.equal(area.children[0].tag,'iframe');assert.equal(area.children[0].src,'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&playsinline=1');assert.equal(area.children[0].referrerPolicy,'strict-origin-when-cross-origin');assert.equal(area.children[1].href,link);
}
assert.equal(context.projectVideoUrl('https://youtube.com.evil.test/watch?v=wYvvs9OY7ZY'),null);
assert.equal(context.projectVideoUrl('https://youtu.be/not-valid'),null);
vm.runInContext("if(!githubProjects.every(p=>(p.description+' '+p.note).includes('Codex')))throw Error('Missing Codex credit');if(githubProjects.filter(p=>p.video).length!==2)throw Error('Missing video links')",context);
console.log('PASS: both YouTube videos, safe embed host, fallback links, Codex credits');

