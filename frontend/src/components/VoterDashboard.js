import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, ListGroup, Alert, Spinner } from 'react-bootstrap';
import { getElectionContract, formatMetamaskError, getSigner } from '../utils/web3';

function VoterDashboard({ currentAccount }) {
    const [elections, setElections] = useState([]);
    const [selectedElectionId, setSelectedElectionId] = useState(null);
    const [electionStatus, setElectionStatus] = useState({ name: '', started: false, ended: false, votesCast: 0, winningCandidateName: '' });
    const [candidates, setCandidates] = useState([]);
    const [voterStatus, setVoterStatus] = useState({ isRegistered: false, hasVoted: false });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loadingVote, setLoadingVote] = useState(false);
    const [loadingElections, setLoadingElections] = useState(true);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    // Fetches all created election IDs and their summaries
    const fetchAllElections = useCallback(async () => {
        setLoadingElections(true);
        try {
            const contract = await getElectionContract();
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
            console.error("Error fetching elections list for voter:", error);
            showMessage('danger', `Error fetching elections list: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingElections(false);
        }
    }, []);

    // Fetches detailed status for the currently selected election
    const fetchElectionDetails = useCallback(async () => {
        if (!currentAccount || selectedElectionId === null) {
            setElectionStatus({ name: '', started: false, ended: false, votesCast: 0, winningCandidateName: '' });
            setCandidates([]);
            setVoterStatus({ isRegistered: false, hasVoted: false });
            return;
        }
        try {
            const contract = await getElectionContract();
            const status = await contract.getElectionStatus(selectedElectionId);
            const electionName = status.name;
            const votesCast = status.votesCast.toString();

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

            const voterStat = await contract.getVoterStatus(selectedElectionId, currentAccount);
            setVoterStatus({ isRegistered: voterStat.isRegistered, hasVoted: voterStat.hasVotedStatus });

        } catch (error) {
            console.error(`Error fetching details for election ID ${selectedElectionId} for voter:`, error);
            showMessage('danger', `Error fetching election details: ${formatMetamaskError(error)}`);
            // If there's an error fetching details, deselect the election
            setSelectedElectionId(null);
        }
    }, [currentAccount, selectedElectionId]);

    useEffect(() => {
        fetchAllElections();
    }, [fetchAllElections]);

    useEffect(() => {
        fetchElectionDetails();
    }, [selectedElectionId, fetchElectionDetails, currentAccount, electionStatus.started, electionStatus.ended]); // Dependencies for re-fetching

    const handleSelectElection = (id) => {
        setSelectedElectionId(id);
        // Reset message when selecting a new election
        setMessage({ type: '', text: '' });
    };

    const handleVote = async (candidateIndex) => {
        if (!voterStatus.isRegistered) {
            showMessage('danger', 'You are not a registered voter for this election.');
            return;
        }
        if (voterStatus.hasVoted) {
            showMessage('danger', 'You have already cast your vote for this election.');
            return;
        }
        if (!electionStatus.started || electionStatus.ended) {
            showMessage('danger', 'Voting is not currently open for this election.');
            return;
        }

        setLoadingVote(true);
        try {
            const signer = await getSigner();
            const contract = await getElectionContract(signer);
            const tx = await contract.vote(selectedElectionId, candidateIndex);
            await tx.wait();
            showMessage('success', `Successfully voted for ${candidates[candidateIndex].name} in election ID ${selectedElectionId}!`);
            fetchElectionDetails(); // Update voter status and candidate vote counts
        } catch (error) {
            console.error("Error casting vote:", error);
            showMessage('danger', `Failed to cast vote: ${formatMetamaskError(error)}`);
        } finally {
            setLoadingVote(null); // Changed from false to null for consistency with AdminDashboard
        }
    };

    return (
        <Card className="my-4 rounded-lg shadow-lg">
            <Card.Header className="bg-dark text-white font-bold text-center text-2xl py-3 rounded-t-lg">
                Voter Dashboard {selectedElectionId !== null ? `(Election ID: ${selectedElectionId} - ${electionStatus.name})` : ''}
            </Card.Header>
            <Card.Body className="p-5">
                {message.text && <Alert variant={message.type} className="mb-4 rounded-md">{message.text}</Alert>}

                {/* Section for Election Selection */}
                {selectedElectionId === null ? (
                    <>
                        <h3 className="mb-4 text-primary font-bold">Select an Election to View/Vote</h3>
                        {loadingElections ? (
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Loading Elections...</span>
                            </Spinner>
                        ) : (
                            <>
                                {elections.length === 0 ? (
                                    <Alert variant="info" className="rounded-md">No elections available.</Alert>
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
                    </>
                ) : (
                    <>
                        {/* Election Details for Selected Election */}
                        <h3 className="mb-4 text-primary font-bold">
                            Details for: {electionStatus.name} (ID: {selectedElectionId})
                        </h3>
                        <div className="mb-5 p-4 bg-light rounded-lg shadow-sm">
                            <h4 className="text-primary mb-3">Current Election Status</h4>
                            <p className="mb-1"><strong>Name:</strong> {electionStatus.name || 'Not Set'}</p>
                            <p className="mb-1"><strong>Status:</strong> {electionStatus.started ? (electionStatus.ended ? 'Ended' : 'Started') : 'Not Started'}</p>
                            <p className="mb-0"><strong>Your Status:</strong> {voterStatus.isRegistered ? 'Registered' : 'Not Registered'} | {voterStatus.hasVoted ? 'Voted' : 'Not Voted Yet'}</p>
                        </div>

                        {electionStatus.ended && electionStatus.winningCandidateName && (
                            <Alert variant="info" className="mt-3 rounded-md">
                                <h4 className="mb-0">Winner: <strong className="text-primary">{electionStatus.winningCandidateName}</strong></h4>
                            </Alert>
                        )}

                        <h5 className="mt-4 text-secondary border-b pb-2 mb-4">Candidates</h5>
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
                                        <Button
                                            onClick={() => handleVote(index)}
                                            disabled={!electionStatus.started || electionStatus.ended || !voterStatus.isRegistered || voterStatus.hasVoted || loadingVote}
                                            variant="primary"
                                            className="rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                                        >
                                            {loadingVote ? <Spinner animation="border" size="sm" /> : 'Vote'}
                                        </Button>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                        <Button
                            variant="secondary"
                            onClick={() => setSelectedElectionId(null)}
                            className="mt-4 rounded-md px-4 py-2 shadow-sm hover:scale-105 transition-transform"
                        >
                            Back to Election Selection
                        </Button>
                    </>
                )}
            </Card.Body>
        </Card>
    );
}

export default VoterDashboard;