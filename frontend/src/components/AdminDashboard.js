// frontend/src/components/AdminDashboard.js

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Card, ListGroup, Alert, Spinner } from 'react-bootstrap';
import { getElectionContract, formatMetamaskError, getSigner } from '../utils/web3';
import { ethers } from 'ethers';

function AdminDashboard({ currentAccount, onRoleChange }) {
    const [elections, setElections] = useState([]);
    const [selectedElectionId, setSelectedElectionId] = useState(null);
    const [electionStatus, setElectionStatus] = useState({ name: '', started: false, ended: false, votesCast: 0, winningCandidateName: '' });
    const [candidates, setCandidates] = useState([]);

    const [newElectionId, setNewElectionId] = useState('');
    const [newElectionName, setNewElectionName] = useState('');
    const [voterAddress, setVoterAddress] = useState('');
    const [candidateName, setCandidateName] = useState('');
    const [candidateParty, setCandidateParty] = useState('');
    const [candidateSymbol, setCandidateSymbol] = useState('');
    const [adminToAdd, setAdminToAdd] = useState('');
    const [adminToRemove, setAdminToRemove] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loadingAction, setLoadingAction] = useState(null);
    const [loadingElections, setLoadingElections] = useState(true);
    const [creatingElection, setCreatingElection] = useState(false);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    // Fetches all created election IDs and their summaries
    const fetchAllElections = useCallback(async () => {
        setLoadingElections(true);
        try {
            const contract = await getElectionContract();
            console.log("AdminDashboard - Contract Object for fetchAllElections:", contract); // Debugging
            const createdIds = await contract.getCreatedElectionIds();
            const fetchedElections = [];

            for (const id of createdIds) {
                try {
                    const summary = await contract.getElectionSummary(id);
                    fetchedElections.push({
                        id: id, // Removed .toNumber()
                        name: summary.name,
                        started: summary.started,
                        ended: summary.ended
                    });
                } catch (innerError) {
                    console.error(`Error fetching summary for existing Election ID ${id}:`, formatMetamaskError(innerError));
                }
            }
            setElections(fetchedElections);
        } catch (error) {
            console.error("Error fetching elections list:", error);
            showMessage('danger', `Error fetching elections list: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingElections(false);
        }
    }, []);

    // Fetches detailed status for the currently selected election
    const fetchElectionDetails = useCallback(async () => {
        if (selectedElectionId === null) {
            setElectionStatus({ name: '', started: false, ended: false, votesCast: 0, winningCandidateName: '' });
            setCandidates([]);
            return;
        }
        try {
            const contract = await getElectionContract();
            const status = await contract.getElectionStatus(selectedElectionId);
            const electionName = status.name; // Get name from status
            const votesCast = status.votesCast.toString(); // Convert BigNumber to string

            let winnerName = '';
            if (status.ended) {
                try {
                    winnerName = await contract.getWinner(selectedElectionId);
                } catch (winErr) {
                    console.warn(`Could not fetch winner for election ID ${selectedElectionId}:`, formatMetamaskError(winErr));
                    winnerName = 'Results not declared or no winner';
                }
            }

            setElectionStatus({
                name: electionName,
                started: status.started,
                ended: status.ended,
                votesCast: votesCast,
                winningCandidateName: winnerName
            });

            const fetchedCandidates = await contract.getCandidates(selectedElectionId);
            const formattedCandidates = fetchedCandidates.map(c => ({
                name: c.name,
                party: c.party,
                symbol: c.symbol,
                voteCount: c.voteCount.toString()
            }));
            setCandidates(formattedCandidates);
        } catch (error) {
            console.error(`Error fetching details for election ID ${selectedElectionId}:`, error);
            showMessage('danger', `Error fetching election details: ${formatMetamaskError(error)}`);
            // If there's an error fetching details, deselect the election
            setSelectedElectionId(null);
        }
    }, [selectedElectionId]);

    useEffect(() => {
        fetchAllElections();
    }, [fetchAllElections]);

    useEffect(() => {
        fetchElectionDetails();
    }, [selectedElectionId, fetchElectionDetails, electionStatus.started, electionStatus.ended]); // Re-fetch details when selectedElectionId or election status changes

    const handleSelectElection = (id) => {
        setSelectedElectionId(id);
        // Reset message when selecting a new election
        setMessage({ type: '', text: '' });
    };

    const handleCreateElection = async () => {
        setCreatingElection(true);
        try {
            if (!newElectionId.trim() || !newElectionName.trim()) {
                showMessage('danger', 'Election ID and Name cannot be empty.');
                setCreatingElection(false);
                return;
            }
            const idNum = parseInt(newElectionId);
            if (isNaN(idNum) || idNum < 0) {
                showMessage('danger', 'Election ID must be a non-negative number.');
                setCreatingElection(false);
                return;
            }

            const existingElection = elections.find(e => e.id === idNum);
            if (existingElection) {
                showMessage('danger', `Election with ID ${idNum} already exists: ${existingElection.name}. Please choose a different ID.`);
                setCreatingElection(false);
                return;
            }

            console.log(`Attempting to create election with ID: ${idNum}, Name: "${newElectionName}"`);
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.createElection(idNum, newElectionName);
            await tx.wait();
            showMessage('success', `Election "${newElectionName}" (ID: ${idNum}) created successfully!`);
            setNewElectionId('');
            setNewElectionName('');
            fetchAllElections(); // Refresh list of elections
            setSelectedElectionId(idNum); // Automatically select the newly created election
            onRoleChange(); // Notify App.js if needed (e.g., for global admin status check)
        } catch (error) {
            console.error("Error creating election:", error);
            showMessage('danger', `Failed to create election: ${formatMetamaskError(error)}. Please ensure you are an admin and the ID is unique.`);
        } finally {
            setCreatingElection(false);
        }
    };

    const handleStartElection = async () => {
        setLoadingAction('startElection');
        try {
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.startElection(selectedElectionId);
            await tx.wait();
            showMessage('success', `Election "${electionStatus.name}" started successfully!`);
            fetchElectionDetails(); // Re-fetch election status and candidates
        } catch (error) {
            console.error("Error starting election:", error);
            showMessage('danger', `Failed to start election: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleEndElection = async () => {
        setLoadingAction('endElection');
        try {
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.endElection(selectedElectionId);
            await tx.wait();
            showMessage('success', 'Election ended successfully!');
            fetchElectionDetails(); // Re-fetch election status and candidates
        } catch (error) {
            console.error("Error ending election:", error);
            showMessage('danger', `Failed to end election: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleAddVoter = async () => {
        setLoadingAction('addVoter');
        try {
            if (!ethers.isAddress(voterAddress)) {
                showMessage('danger', 'Invalid voter address format.');
                setLoadingAction(null);
                return;
            }
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.addVoter(selectedElectionId, voterAddress);
            await tx.wait();
            showMessage('success', `Voter ${voterAddress} added successfully to election ID ${selectedElectionId}!`);
            setVoterAddress('');
            // No need to call onRoleChange here as voter status is election-specific
        } catch (error) {
            console.error("Error adding voter:", error);
            showMessage('danger', `Failed to add voter: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleAddCandidate = async () => {
        setLoadingAction('addCandidate');
        try {
            if (!candidateName.trim()) {
                showMessage('danger', 'Candidate name cannot be empty.');
                setLoadingAction(null);
                return;
            }
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.addCandidate(selectedElectionId, candidateName, candidateParty, candidateSymbol);
            await tx.wait();
            showMessage('success', `Candidate "${candidateName}" added successfully to election ID ${selectedElectionId}!`);
            setCandidateName('');
            setCandidateParty('');
            setCandidateSymbol('');
            fetchElectionDetails(); // Refresh candidate list
        } catch (error) {
            console.error("Error adding candidate:", error);
            showMessage('danger', `Failed to add candidate: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDeclareResults = async () => {
        setLoadingAction('declareResults');
        try {
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.declareResults(selectedElectionId);
            await tx.wait();
            // Winner name is now fetched as part of fetchElectionDetails
            showMessage('success', `Results declared for election ID ${selectedElectionId}!`);
            fetchElectionDetails(); // Re-fetch election status to show winner
        } catch (error) {
            console.error("Error declaring results:", error);
            showMessage('danger', `Failed to declare results: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleAddAdmin = async () => {
        setLoadingAction('addAdmin');
        try {
            if (!ethers.isAddress(adminToAdd)) {
                showMessage('danger', 'Invalid admin address format.');
                setLoadingAction(null);
                return;
            }
            const contract = await getElectionContract();
            const checkIfAdmin = await contract.isAdmin(adminToAdd);
            if (checkIfAdmin) {
                showMessage('info', `Address ${adminToAdd} is already an admin.`);
                setLoadingAction(null);
                return;
            }

            const signer = await getSigner();
            const writeContract = await getElectionContract(signer);
            const tx = await writeContract.addAdmin(adminToAdd);
            await tx.wait();
            showMessage('success', `Admin ${adminToAdd} added successfully!`);
            setAdminToAdd('');
            onRoleChange(); // Trigger App.js to re-check global admin status
        } catch (error) {
            console.error("Error adding admin:", error);
            showMessage('danger', `Failed to add admin: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleRemoveAdmin = async () => {
        setLoadingAction('removeAdmin');
        try {
            if (!ethers.isAddress(adminToRemove)) {
                showMessage('danger', 'Invalid admin address format.');
                setLoadingAction(null);
                return;
            }
            const contract = await getElectionContract();
            const checkIfAdmin = await contract.isAdmin(adminToRemove);
            if (!checkIfAdmin) {
                showMessage('info', `Address ${adminToRemove} is not an admin.`);
                setLoadingAction(null);
                return;
            }

            const signer = await getSigner();
            const writeContract = await getElectionContract(signer);
            const tx = await writeContract.removeAdmin(adminToRemove);
            await tx.wait();
            showMessage('success', `Admin ${adminToRemove} removed successfully!`);
            setAdminToRemove('');
            onRoleChange(); // Trigger App.js to re-check global admin status
        } catch (error) {
            console.error("Error removing admin:", error);
            showMessage('danger', `Failed to remove admin: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <Card className="my-4 rounded-lg shadow-lg">
            <Card.Header className="bg-dark text-white font-bold text-center text-2xl py-3 rounded-t-lg">
                Admin Dashboard {selectedElectionId !== null ? `(Election ID: ${selectedElectionId} - ${electionStatus.name})` : ''}
            </Card.Header>
            <Card.Body className="p-5">
                {message.text && <Alert variant={message.type} className="mb-4 rounded-md">{message.text}</Alert>}

                {/* Section for Election Selection */}
                <h3 className="mb-4 text-primary font-bold">Select an Election to Manage</h3>
                {loadingElections ? (
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading Elections...</span>
                    </Spinner>
                ) : (
                    <>
                        {elections.length === 0 ? (
                            <Alert variant="info" className="rounded-md">No elections available. Create one below.</Alert>
                        ) : (
                            <ListGroup className="mb-4 text-left">
                                {elections.map((election) => (
                                    <ListGroup.Item
                                        key={election.id}
                                        action
                                        onClick={() => handleSelectElection(election.id)}
                                        active={selectedElectionId === election.id}
                                        className="d-flex justify-content-between align-items-center rounded-md p-3 mb-2 bg-white hover:bg-gray-50 transition-colors"
                                    >
                                        <div>
                                            <h5 className="mb-1 text-lg text-dark">
                                                {election.name} (ID: {election.id.toString()})
                                            </h5>
                                            <small className={`font-bold ${election.ended ? 'text-danger' : (election.started ? 'text-success' : 'text-warning')}`}>
                                                Status: {election.ended ? 'Ended' : (election.started ? 'Started' : 'Not Started')}
                                            </small>
                                        </div>
                                        <Button variant="outline-primary" size="sm" className="rounded-md">
                                            {selectedElectionId === election.id ? 'Selected' : 'Select'}
                                        </Button>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </>
                )}

                {/* Election Creation Form */}
                <div className="mt-5 pt-4 border-t border-gray-200">
                    <h3 className="mb-4 text-secondary font-bold">Create New Election</h3>
                    <Form className="p-4 bg-light rounded-lg shadow-sm">
                        <Form.Group className="mb-3">
                            <Form.Label className="font-semibold">Election ID (Number)</Form.Label>
                            <Form.Control
                                type="number"
                                placeholder="e.g., 1, 2, 3"
                                value={newElectionId}
                                onChange={(e) => setNewElectionId(e.target.value)}
                                disabled={creatingElection}
                                className="rounded-md"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="font-semibold">Election Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g., General Election 2024"
                                value={newElectionName}
                                onChange={(e) => setNewElectionName(e.target.value)}
                                disabled={creatingElection}
                                className="rounded-md"
                            />
                        </Form.Group>
                        <Button
                            onClick={handleCreateElection}
                            disabled={creatingElection || !newElectionId.trim() || !newElectionName.trim()}
                            variant="success"
                            className="rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                        >
                            {creatingElection ? <Spinner animation="border" size="sm" /> : 'Create Election'}
                        </Button>
                    </Form>
                </div>

                {/* Election Management for Selected Election */}
                {selectedElectionId !== null && (
                    <div className="mt-5 pt-4 border-t border-gray-200">
                        <h3 className="mb-4 text-primary font-bold">
                            Management for: {electionStatus.name} (ID: {selectedElectionId})
                        </h3>

                        {/* Current Election Status Display */}
                        <div className="mb-5 p-4 bg-light rounded-lg shadow-sm">
                            <h4 className="text-primary mb-3">Current Election Status</h4>
                            <p className="mb-1"><strong>Name:</strong> {electionStatus.name || 'Not Set'}</p>
                            <p className="mb-1"><strong>Started:</strong> {electionStatus.started ? 'Yes' : 'No'}</p>
                            <p className="mb-1"><strong>Ended:</strong> {electionStatus.ended ? 'Yes' : 'No'}</p>
                            <p className="mb-0"><strong>Total Votes Cast:</strong> {electionStatus.votesCast.toString()}</p>
                            {electionStatus.ended && electionStatus.winningCandidateName && (
                                <p className="mb-0"><strong>Winner:</strong> {electionStatus.winningCandidateName}</p>
                            )}
                        </div>

                        {/* Election Control Buttons */}
                        <h5 className="mt-3 text-secondary border-b pb-2 mb-4">Election Controls</h5>
                        <Form className="mb-5 p-4 bg-light rounded-lg shadow-sm">
                            <div className="d-flex flex-wrap gap-2">
                                <Button
                                    onClick={handleStartElection}
                                    disabled={electionStatus.started || loadingAction === 'startElection' || candidates.length === 0}
                                    className="btn-primary rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                                >
                                    {loadingAction === 'startElection' ? <Spinner animation="border" size="sm" /> : 'Start Election'}
                                </Button>
                                <Button
                                    onClick={handleEndElection}
                                    disabled={!electionStatus.started || electionStatus.ended || loadingAction === 'endElection'}
                                    variant="warning"
                                    className="rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                                >
                                    {loadingAction === 'endElection' ? <Spinner animation="border" size="sm" /> : 'End Election'}
                                </Button>
                                <Button
                                    onClick={handleDeclareResults}
                                    disabled={!electionStatus.ended || loadingAction === 'declareResults' || (electionStatus.ended && electionStatus.winningCandidateName && electionStatus.winningCandidateName !== 'Results not declared or no winner')}
                                    variant="success"
                                    className="rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                                >
                                    {loadingAction === 'declareResults' ? <Spinner animation="border" size="sm" /> : 'Declare Results'}
                                </Button>
                            </div>
                        </Form>

                        {/* Add Voter */}
                        <h5 className="mt-4 text-secondary border-b pb-2 mb-4">Add Voter</h5>
                        <Form className="mb-5 p-4 bg-light rounded-lg shadow-sm">
                            <Form.Group className="mb-3">
                                <Form.Label className="font-semibold">Voter Wallet Address</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="0x..."
                                    value={voterAddress}
                                    onChange={(e) => setVoterAddress(e.target.value)}
                                    disabled={electionStatus.started || loadingAction !== null}
                                    className="rounded-md"
                                />
                            </Form.Group>
                            <Button
                                onClick={handleAddVoter}
                                disabled={electionStatus.started || loadingAction === 'addVoter' || !voterAddress.trim()}
                                className="btn-info rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                            >
                                {loadingAction === 'addVoter' ? <Spinner animation="border" size="sm" /> : 'Add Voter'}
                            </Button>
                        </Form>

                        {/* Add Candidate */}
                        <h5 className="mt-4 text-secondary border-b pb-2 mb-4">Add Candidate</h5>
                        <Form className="mb-5 p-4 bg-light rounded-lg shadow-sm">
                            <Form.Group className="mb-3">
                                <Form.Label className="font-semibold">Candidate Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g., Alice"
                                    value={candidateName}
                                    onChange={(e) => setCandidateName(e.target.value)}
                                    disabled={electionStatus.started || loadingAction !== null}
                                    className="rounded-md"
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-semibold">Party Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g., Green Party"
                                    value={candidateParty}
                                    onChange={(e) => setCandidateParty(e.target.value)}
                                    disabled={electionStatus.started || loadingAction !== null}
                                    className="rounded-md"
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-semibold">Symbol (URL)</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g., https://example.com/symbol.png"
                                    value={candidateSymbol}
                                    onChange={(e) => setCandidateSymbol(e.target.value)}
                                    disabled={electionStatus.started || loadingAction !== null}
                                    className="rounded-md"
                                />
                            </Form.Group>
                            <Button
                                onClick={handleAddCandidate}
                                disabled={electionStatus.started || loadingAction === 'addCandidate' || !candidateName.trim()}
                                className="btn-success rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                            >
                                {loadingAction === 'addCandidate' ? <Spinner animation="border" size="sm" /> : 'Add Candidate'}
                            </Button>
                        </Form>

                        {/* Current Candidates List */}
                        <h5 className="mt-4 text-secondary border-b pb-2 mb-4">Candidates List</h5>
                        {candidates.length === 0 ? (
                            <Alert variant="info" className="rounded-md">No candidates added yet for this election.</Alert>
                        ) : (
                            <ListGroup className="rounded-lg shadow-sm">
                                {candidates.map((candidate, index) => (
                                    <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center rounded-md p-3 mb-2 bg-white hover:bg-gray-50 transition-colors">
                                        <div>
                                            <strong className="text-lg text-primary">{candidate.name}</strong> ({candidate.party})
                                            {candidate.symbol && <img src={candidate.symbol} alt="symbol" className="ms-3 rounded-full" style={{ width: '40px', height: '40px', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/40x40/cccccc/000000?text=No+Img"; }} />}
                                            {electionStatus.ended && (
                                                <span className="ms-3 badge bg-dark text-white p-2 rounded-pill">Votes: {candidate.voteCount}</span>
                                            )}
                                        </div>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </div>
                )}

                {/* Manage Global Admins (Deployer Only) */}
                <div className="mt-5 pt-4 border-t border-gray-200">
                    <h5 className="mt-5 text-secondary border-b pb-2 mb-4">Manage Global Admins (Deployer Only)</h5>
                    <Form className="mb-4 p-4 bg-light rounded-lg shadow-sm">
                        <Form.Group className="mb-3">
                            <Form.Label className="font-semibold">Add Admin Address</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="0x..."
                                value={adminToAdd}
                                onChange={(e) => setAdminToAdd(e.target.value)}
                                disabled={loadingAction !== null}
                                className="rounded-md"
                            />
                        </Form.Group>
                        <Button
                            onClick={handleAddAdmin}
                            disabled={loadingAction === 'addAdmin' || !adminToAdd.trim()}
                            className="btn-secondary rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform me-2"
                        >
                            {loadingAction === 'addAdmin' ? <Spinner animation="border" size="sm" /> : 'Add Admin'}
                        </Button>
                        <Form.Group className="mb-3 mt-3">
                            <Form.Label className="font-semibold">Remove Admin Address</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="0x..."
                                value={adminToRemove}
                                onChange={(e) => setAdminToRemove(e.target.value)}
                                disabled={loadingAction !== null}
                                className="rounded-md"
                            />
                        </Form.Group>
                        <Button
                            onClick={handleRemoveAdmin}
                            disabled={loadingAction === 'removeAdmin' || !adminToRemove.trim()}
                            variant="danger"
                            className="rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                        >
                            {loadingAction === 'removeAdmin' ? <Spinner animation="border" size="sm" /> : 'Remove Admin'}
                        </Button>
                    </Form>
                </div>
            </Card.Body>
        </Card>
    );
}

export default AdminDashboard;