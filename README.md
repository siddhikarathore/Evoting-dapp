# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

# 1. Clone Repository
git clone https://github.com/siddhikarathore/Evoting-dapp.git
cd evoting-dapp

# 2. Install Dependencies
npm install                      # In the root 'evoting-dapp/' directory
cd ../frontend && npm install    # In the 'frontend/' directory

# 3. Start Local Hardhat Node (in a new terminal)
npx hardhat node

# 4. Deploy Smart Contract (in another terminal, in root 'evoting-dapp/')
npx hardhat run scripts/deploy.js --network localhost OR amoy

# 4. Start Frontend App (in 'frontend/' directory)
npm start

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```
