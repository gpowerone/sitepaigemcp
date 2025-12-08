const { transpileCode } = require('./transpiler/transpiler.cjs');

const code = `
function Test() {
  return (
    <div>
      {window.processText("key1", "Visit https://google.com for more info")}
      {window.processText("key2", "No links here")}
      <div title={window.processText("key3", "https://link-in-prop.com")}>Prop</div>
    </div>
  );
}
`;

const dictionary = {
  "key4": "Dictionary link: https://bing.com"
};

const result = JSON.parse(transpileCode(code, [], dictionary));
console.log(result.code);

