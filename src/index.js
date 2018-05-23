import message from './hello';
import './index.sass';

console.log(message);

const paragraph = document.createElement('p');
paragraph.innerHTML = message;

document.body.prepend(paragraph);
