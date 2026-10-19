async function main() {
  const sel = ['0x2bc63e61', '0x78b98955', '0xc45a0155', '0x30361026', '0x216e38bd', '0x1966391b', '0xc9084610', '0xb06ebf3d', '0x13289277', '0xd92e233d', '0x0902f1ac', '0x15a55347', '0x160d0da5', '0x24a9d853', '0x31ff7f22', '0x3729bb9a', '0x3cd1fb8f'].join(',');
  const res = await fetch('https://api.openchain.xyz/signature-database/v1/lookup?function=' + sel);
  const data = await res.json();
  console.log(JSON.stringify(data.result.function, null, 2));
}
main().catch(console.error);
