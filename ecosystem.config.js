module.exports = {
  apps: [
    {
      name: "hoard-solana-daemon",
      script: "solana/scripts/run_production_daemon.ts",
      interpreter: "npx",
      interpreter_args: "ts-node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        TOKEN_MINT: "9JeFE6apEvFotefu1ocjWgSceEc3LG1LhgMxQNB4pump",
        TREASURY_WALLET: "HoardAltarTreasury111111111111111111111111"
      }
    },
    {
      name: "hoard-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
