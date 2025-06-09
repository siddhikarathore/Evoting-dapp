// frontend/src/utils/web3.js

import { ethers } from 'ethers';
import ElectionABI from './ElectionABI.json';

// !!! IMPORTANT: REPLACE THIS WITH YOUR DEPLOYED CONTRACT ADDRESS ON POLYGON AMOY TESTNET !!!
// You MUST get this address from your Hardhat deployment output (e.g., after running npx hardhat run scripts/deploy.js --network amoy)
// And verify it exists on https://amoy.polygonscan.com/
const CONTRACT_ADDRESS = "0xCBfA17A979e30899c726F9988A0aaf61F34601dc"; // <-- UPDATE THIS LINE WITH YOUR ACTUAL DEPLOYED ADDRESS

export const getProvider = () => {
    if (window.ethereum) {
        return new ethers.BrowserProvider(window.ethereum);
    }
    throw new Error('MetaMask not detected! Please install MetaMask.');
};

export const getSigner = async () => {
    const provider = getProvider();
    // Request account access if needed
    await provider.send('eth_requestAccounts', []);
    return provider.getSigner();
};

export const getElectionContract = async (signerOrProvider) => {
    const provider = getProvider();
    const effectiveSignerOrProvider = signerOrProvider || provider;

    // Ensure the contract address is a valid checksummed address string to prevent ENS lookups
    const contractAddress = ethers.getAddress(CONTRACT_ADDRESS);

    const contract = new ethers.Contract(contractAddress, ElectionABI, effectiveSignerOrProvider);
    console.log("Instantiated Contract Object:", contract); // Debugging: Check contract object
    return contract;
};

export const getConnectedAccount = async () => {
    try {
        const provider = getProvider();
        const accounts = await provider.listAccounts();
        return accounts.length > 0 ? accounts[0].address : null;
    } catch (error) {
        console.error("Error getting connected account:", error);
        return null;
    }
};

// Helper for error messages to provide user-friendly feedback
export const formatMetamaskError = (error) => {
    if (error.code === 4001) {
        return "Transaction rejected by user in MetaMask.";
    }
    if (error.reason) {
        // Ethers.js specific error message
        return `Transaction failed: ${error.reason}`;
    }
    if (error.data && error.data.message) {
        // Common error message from EVM revert
        return `Blockchain error: ${error.data.message}`;
    }
    if (error.message && error.message.includes("circuit breaker is open")) {
        return "MetaMask connection issue: Circuit breaker open. Please refresh or check network.";
    }
    if (error.message) {
        return `Error: ${error.message}`;
    }
    return "An unknown error occurred.";
};