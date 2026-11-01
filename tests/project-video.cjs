const fs=require('fs'),vm=require('vm'),assert=require('assert');
function element(tag){return {tag,children:[],className:'',append(...children){this.children.push(...children)},setAttribute(){},replaceChildren(...children){this.children=children},addEventListener(){},play(){return Promise.resolve()}}}
const context={URL,document:{createElement:element,head:{append(){}}}};vm.createContext(context);vm.runInContext(fs.readFileSync('projects.js','utf8'),context);
assert.equal(context.projectVideoUrl('javascript:alert(1)'),null);assert.equal(context.projectVideoUrl('http://example.com/game.mp4'),null);assert.equal(context.projectVideoUrl('https://example.com/game.mp4?v=2'),'https://example.com/game.mp4?v=2');
let media=context.projectMedia({repo:'fishing',name:'낚시게임',emoji:'🎣'});assert(media.children[0].disabled);assert.equal(media.children[0].children[1].textContent,'소개 영상 준비 중');
media=context.projectMedia({repo:'fishing',name:'낚시게임',emoji:'🎣',video:'https://example.com/game.webm'});assert(!media.children[0].disabled);media.children[0].onclick();assert.equal(media.children[0].tag,'video');assert(media.children[0].controls);assert.equal(media.children[0].src,'https://example.com/game.webm');
console.log('PASS: safe video URLs, no-video state, click-to-play video with controls');

