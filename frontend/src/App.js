import React, { useState, useEffect, useCallback } from 'react';
import { Container, Alert, Spinner, Button } from 'react-bootstrap';
import { getSigner, getElectionContract, getConnectedAccount, formatMetamaskError } from './utils/web3';
import AppNavbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboard';
import VoterDashboard from './components/VoterDashboard';
import RoleSelection from './components/RoleSelection';
import { ethers } from 'ethers'; // Corrected: Added ethers import

function App() {
    const [currentAccount, setCurrentAccount] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'Admin', 'Voter', 'Guest'
    const [deployerAddress, setDeployerAddress] = useState(null); // To check if currentAccount is deployer
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // New state for role selection flow
    const [selectedRoleOption, setSelectedRoleOption] = useState(null); // 'Admin', 'Voter', or null (for role selection screen)
    const [isAuthorizedForSelectedRole, setIsAuthorizedForSelectedRole] = useState(false);
    const [authorizationError, setAuthorizationError] = useState('');
    const [checkingAuthorization, setCheckingAuthorization] = useState(false);

    // Function to check wallet connection and determine global admin status
    const checkWalletConnectionAndGlobalRole = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const account = await getConnectedAccount();
            setCurrentAccount(account);

            if (account) {
                console.log("Connected Account:", account);
                const contract = await getElectionContract();
                const deployerRaw = await contract.deployer();
                const checksummedDeployer = ethers.getAddress(deployerRaw).toLowerCase();
                setDeployerAddress(checksummedDeployer);

                const isAdmin = await contract.isAdmin(account);

                // Determine initial role if already an admin.
                // If not an admin, we'll let the user select 'Voter' or 'Guest' via RoleSelection.
                if (isAdmin || account.toLowerCase() === checksummedDeployer) {
                    setUserRole('Admin');
                    setSelectedRoleOption('Admin'); // Auto-select Admin role if they are an admin
                    setIsAuthorizedForSelectedRole(true);
                } else {
                    setUserRole(null); // User needs to select role
                    setSelectedRoleOption(null);
                    setIsAuthorizedForSelectedRole(false);
                }
            } else {
                setUserRole(null);
                setDeployerAddress(null);
                setSelectedRoleOption(null);
                setIsAuthorizedForSelectedRole(false);
                console.log("No account connected.");
            }
        } catch (err) {
            console.error("Error checking wallet/role:", err);
            setError(`Failed to connect or check role: ${formatMetamaskError(err)}`);
            setUserRole(null);
            setSelectedRoleOption(null);
            setIsAuthorizedForSelectedRole(false);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect to run once on component mount to check wallet and initial role
    useEffect(() => {
        checkWalletConnectionAndGlobalRole();

        if (window.ethereum) {
            const handleAccountsChanged = (accounts) => {
                setCurrentAccount(accounts.length > 0 ? accounts[0] : null);
                // Reset role selection and re-check everything on account change
                setSelectedRoleOption(null);
                setIsAuthorizedForSelectedRole(false);
                setAuthorizationError('');
                checkWalletConnectionAndGlobalRole();
            };

            const handleChainChanged = () => {
                window.location.reload();
            };

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                if (window.ethereum) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            };
        }
    }, [checkWalletConnectionAndGlobalRole]);

    // Function to handle role selection from RoleSelection component
    const handleSelectRole = async (role) => {
        setSelectedRoleOption(role);
        setAuthorizationError(''); // Clear previous auth errors
        setCheckingAuthorization(true);

        try {
            const contract = await getElectionContract();
            let authorized = false;

            if (role === 'Admin') {
                const isAdmin = await contract.isAdmin(currentAccount);
                // Deployer is always an admin
                if (isAdmin || (currentAccount && deployerAddress && currentAccount.toLowerCase() === deployerAddress)) {
                    authorized = true;
                } else {
                    setAuthorizationError("Your connected account is not authorized as an Admin for this DApp.");
                }
            } else if (role === 'Voter') {
                // For a voter, we can't check 'isVoter' without an election ID yet.
                // We'll assume they are a potential voter and let the VoterDashboard handle election-specific registration check.
                // So, for now, if they select 'Voter', they are 'authorized' to proceed to the voter dashboard to select an election.
                authorized = true;
            }
            setIsAuthorizedForSelectedRole(authorized);
            setUserRole(role); // Set the userRole state in App.js
        } catch (err) {
            console.error("Error verifying role authorization:", err);
            setAuthorizationError(`Failed to verify authorization: ${formatMetamaskError(err)}`);
            setIsAuthorizedForSelectedRole(false);
            setUserRole(null); // Reset role if authorization fails
            setSelectedRoleOption(null); // Go back to role selection
        } finally {
            setCheckingAuthorization(false);
        }
    };

    const connectWallet = async () => {
        setLoading(true);
        setError('');
        try {
            const signer = await getSigner();
            const account = await signer.getAddress();
            setCurrentAccount(account);
            // After connecting, re-run the full check to determine role
            await checkWalletConnectionAndGlobalRole();
        } catch (err) {
            console.error("Failed to connect wallet:", err);
            setError(`Failed to connect wallet: ${formatMetamaskError(err)}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Container className="text-center my-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p className="mt-2">Connecting to wallet and blockchain...</p>
            </Container>
        );
    }

    return (
        <div>
            <AppNavbar
                currentAccount={currentAccount}
                connectWallet={connectWallet}
                userRole={userRole} // Now reflecting the selected and verified role
            />
            <Container className="mt-4">
                {error && <Alert variant="danger">{error}</Alert>}

                {!currentAccount ? (
                    <Alert variant="info" className="text-center rounded-md">
                        Please connect your MetaMask wallet to proceed.
                    </Alert>
                ) : (
                    <>
                        {/* Step 1: Select Role */}
                        {selectedRoleOption === null ? (
                            <RoleSelection onSelectRole={handleSelectRole} />
                        ) : (
                            <>
                                {/* Step 2: Check Authorization for Selected Role */}
                                {checkingAuthorization ? (
                                    <div className="text-center my-5">
                                        <Spinner animation="border" role="status">
                                            <span className="visually-hidden">Checking authorization...</span>
                                        </Spinner>
                                        <p className="mt-2">Checking if your account is authorized as a {selectedRoleOption}...</p>
                                    </div>
                                ) : isAuthorizedForSelectedRole ? (
                                    // Step 3: Render Dashboard based on Authorized Role
                                    selectedRoleOption === 'Admin' ? (
                                        <AdminDashboard
                                            currentAccount={currentAccount}
                                            onRoleChange={checkWalletConnectionAndGlobalRole} // Allows AdminDashboard to trigger re-check of global admin status
                                        />
                                    ) : ( // selectedRoleOption === 'Voter'
                                        <VoterDashboard
                                            currentAccount={currentAccount}
                                        />
                                    )
                                ) : (
                                    // Step 4: Show Authorization Failed Message
                                    <Alert variant="danger" className="text-center rounded-md">
                                        <h4>Authorization Failed!</h4>
                                        <p>{authorizationError}</p>
                                        <p>Connected account: <strong>{currentAccount}</strong></p>
                                        <Button variant="primary" onClick={() => {
                                            setSelectedRoleOption(null); // Go back to role selection
                                            setAuthorizationError(''); // Clear error
                                            setUserRole(null); // Reset userRole in App.js
                                        }} className="mt-3 rounded-md">
                                            Go Back to Role Selection
                                        </Button>
                                    </Alert>
                                )}
                            </>
                        )}
                    </>
                )}
            </Container>
        </div>
    );
}

export default App;