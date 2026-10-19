async function main() {
  const res = await fetch("https://api.openchain.xyz/signature-database/v1/lookup?function=0xbc760cfe");
  const data = await res.json();
  console.log("Error info:", JSON.stringify(data.result.function, null, 2));
}
main().catch(console.error);
