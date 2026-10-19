const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { Keypair } = require('@solana/web3.js');
let bs58 = require('bs58');
if (bs58.default) bs58 = bs58.default;

// Note: Base58 excludes uppercase 'O', 'I', 'l', and '0'.
// Valid goblin suffixes: 'Gob', 'gob', 'GoB'
const SUFFIXES = ['Gob', 'gob'];

if (isMainThread) {
  const numCPUs = os.cpus().length;
  console.log(`🚀 Starting multi-core vanity grinder across ${numCPUs} CPU cores for suffixes ['Gob', 'gob']...`);
  const start = Date.now();
  let found = false;

  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(__filename, { workerData: { workerId: i } });
    worker.on('message', (msg) => {
      if (msg.success && !found) {
        found = true;
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`\n🎉 FOUND VANITY KEYPAIR in ${elapsed}s!`);
        console.log(`Public Key:  ${msg.publicKey}`);
        console.log(`Private Key: ${msg.privateKey}`);
        process.exit(0);
      }
    });
  }
} else {
  let count = 0;
  while (true) {
    count++;
    const kp = Keypair.generate();
    const pub = kp.publicKey.toBase58();
    if (pub.endsWith('Gob') || pub.endsWith('gob')) {
      parentPort.postMessage({
        success: true,
        publicKey: pub,
        privateKey: bs58.encode(kp.secretKey),
        count
      });
      break;
    }
  }
}
