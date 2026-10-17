/** Small arithmetic grammar; never evaluates JavaScript or arbitrary input. */
export function calculate(expression:string):string {
  const source=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/\s/g,'');
  if(source.length>160||!source)throw new Error('Enter a calculation');
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/%\-]/g)||[];
  if(tokens.join('')!==source)throw new Error('Check the calculation');
  let at=0;
  function factor():number {let value:number;const token=tokens[at++];
    if(token==='+'||token==='-')value=(token==='-'?-1:1)*factor();
    else if(token==='('){value=sum();if(tokens[at++]!==')')throw new Error('Close the bracket');}
    else {if(!token||!/^\d*\.?\d/.test(token))throw new Error('Check the calculation');value=Number(token);}
    while(tokens[at]==='%'){at++;value/=100;}return value;
  }
  function product():number {let value=factor();while(['*','/'].includes(tokens[at])){const op=tokens[at++],next=factor();if(op==='/'&&next===0)throw new Error('Cannot divide by zero');value=op==='*'?value*next:value/next;}return value;}
  function sum():number {let value=product();while(['+','-'].includes(tokens[at])){const op=tokens[at++],next=product();value=op==='+'?value+next:value-next;}return value;}
  const result=sum();if(at!==tokens.length||!Number.isFinite(result)||Math.abs(result)>1e15)throw new Error('Check the calculation');
  return result===0?'0':result.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:12});
}
