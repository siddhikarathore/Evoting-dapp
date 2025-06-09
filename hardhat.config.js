require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config(); // <-- Add this line

const AMOY_RPC_URL = process.env.AMOY_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      // Local development network
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
    },
    amoy: { // <-- Add this new network configuration
      url: AMOY_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      chainId: 80002, // Chain ID for Polygon Amoy Testnet
      gasPrice: 100000000000, // Optional: Adjust gas price if transactions are stuck (100 Gwei example)
      // gas: 2100000, // Optional: Set a higher gas limit if needed
    },
  },
  etherscan: { // Optional: For contract verification on Polygonscan
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY // Get this from Polygonscan
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  }
};