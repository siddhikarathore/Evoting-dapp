// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Election {
    address public deployer;
    mapping(address => bool) public isAdmin; // Global admin status

    // Struct to hold all data for a single election
    struct ElectionData {
        string name;
        bool started;
        bool ended;
        uint256 totalVotesCast;
        uint256 winningCandidateIndex; // Index in the candidates array for this specific election
        string winningCandidateName;

        // Election-specific data
        mapping(address => bool) voters; // true if registered, false otherwise for this election
        mapping(address => bool) hasVoted; // true if already voted for this election
        Candidate[] candidates; // Array of candidates for this specific election
    }

    // Struct for a candidate (remains the same)
    struct Candidate {
        string name;
        string party;
        string symbol; // Can be a URL to an image hosted on IPFS/centralized server
        uint256 voteCount;
    }

    // Mapping from election ID (uint256) to ElectionData struct
    mapping(uint256 => ElectionData) public elections;
    mapping(uint256 => bool) public electionExistsById; // NEW: To track if an election ID has been created
    uint256 public nextElectionId; // To keep track of the next available election ID

    // Events (modified to include electionId where relevant)
    event ElectionCreated(uint256 indexed electionId, string name);
    event ElectionStarted(uint256 indexed electionId, string name);
    event ElectionEnded(uint256 indexed electionId);
    event VoterRegistered(uint256 indexed electionId, address indexed voterAddress);
    event CandidateAdded(uint256 indexed electionId, string name, string party, string symbol);
    event VoteCast(uint256 indexed electionId, address indexed voter, uint256 indexed candidateIndex);
    event ResultsDeclared(uint256 indexed electionId, string winnerName);
    event AdminAdded(address indexed adminAddress);
    event AdminRemoved(address indexed adminAddress);

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Only the deployer can perform this action.");
        _;
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Only admin can perform this action.");
        _;
    }

    // Modifiers now take electionId
    modifier electionExists(uint256 _electionId) {
        require(electionExistsById[_electionId], "Election does not exist."); // Use new mapping
        _;
    }

    modifier electionNotStarted(uint256 _electionId) {
        require(!elections[_electionId].started, "Election has already started.");
        _;
    }

    modifier electionStartedAndNotEnded(uint256 _electionId) {
        require(elections[_electionId].started && !elections[_electionId].ended, "Election is not in voting phase.");
        _;
    }

    modifier electionEndedStatus(uint256 _electionId) {
        require(elections[_electionId].ended, "Election has not ended yet.");
        _;
    }

    modifier notVotedYet(uint256 _electionId) {
        require(!elections[_electionId].hasVoted[msg.sender], "You have already cast your vote.");
        _;
    }

    modifier onlyVoter(uint256 _electionId) {
        require(elections[_electionId].voters[msg.sender], "Only registered voters can perform this action.");
        _;
    }

    constructor() {
        deployer = msg.sender;
        isAdmin[msg.sender] = true; // Deployer is automatically a global admin
        nextElectionId = 0; // Start with ID 0
    }

    // --- Admin Functions ---

    // Global admin management (not tied to a specific election)
    function addAdmin(address _adminAddress) public onlyDeployer {
        require(_adminAddress != address(0), "Invalid address.");
        require(!isAdmin[_adminAddress], "Address is already an admin.");
        isAdmin[_adminAddress] = true;
        emit AdminAdded(_adminAddress);
    }

    function removeAdmin(address _adminAddress) public onlyDeployer {
        require(_adminAddress != address(0), "Invalid address.");
        require(isAdmin[_adminAddress], "Address is not an admin.");
        require(_adminAddress != deployer, "Cannot remove the deployer as admin.");
        isAdmin[_adminAddress] = false;
        emit AdminRemoved(_adminAddress);
    }

    // Function to create a new election
    function createElection(uint256 _electionId, string memory _electionName) public onlyAdmin {
        require(bytes(_electionName).length > 0, "Election name cannot be empty.");
        require(!electionExistsById[_electionId], "Election with this ID already exists."); // Use new mapping for check

        elections[_electionId].name = _electionName;
        elections[_electionId].started = false;
        elections[_electionId].ended = false;
        elections[_electionId].totalVotesCast = 0;
        electionExistsById[_electionId] = true; // Mark this ID as existing

        // Increment nextElectionId if the new ID is greater than or equal to current nextElectionId
        if (_electionId >= nextElectionId) {
            nextElectionId = _electionId + 1;
        }

        emit ElectionCreated(_electionId, _electionName);
    }

    // Election-specific admin functions
    function startElection(uint256 _electionId) public onlyAdmin electionExists(_electionId) electionNotStarted(_electionId) {
        require(elections[_electionId].candidates.length > 0, "Cannot start an election with no candidates.");
        elections[_electionId].started = true;
        emit ElectionStarted(_electionId, elections[_electionId].name);
    }

    function endElection(uint256 _electionId) public onlyAdmin electionExists(_electionId) electionStartedAndNotEnded(_electionId) {
        elections[_electionId].ended = true;
        emit ElectionEnded(_electionId);
    }

    function addVoter(uint256 _electionId, address _voterAddress) public onlyAdmin electionExists(_electionId) electionNotStarted(_electionId) {
        require(_voterAddress != address(0), "Invalid address.");
        require(!elections[_electionId].voters[_voterAddress], "Voter already registered for this election.");
        elections[_electionId].voters[_voterAddress] = true;
        emit VoterRegistered(_electionId, _voterAddress);
    }

    function addCandidate(uint256 _electionId, string memory _name, string memory _party, string memory _symbol) public onlyAdmin electionExists(_electionId) electionNotStarted(_electionId) {
        require(bytes(_name).length > 0, "Candidate name cannot be empty.");
        // Symbol can be empty if not used
        elections[_electionId].candidates.push(Candidate(_name, _party, _symbol, 0));
        emit CandidateAdded(_electionId, _name, _party, _symbol);
    }

    function declareResults(uint256 _electionId) public onlyAdmin electionExists(_electionId) electionEndedStatus(_electionId) {
        require(bytes(elections[_electionId].winningCandidateName).length == 0, "Results already declared for this election."); // Prevent re-declaration

        uint256 maxVotes = 0;
        int256 winnerIdx = -1;

        for (uint256 i = 0; i < elections[_electionId].candidates.length; i++) {
            if (elections[_electionId].candidates[i].voteCount > maxVotes) {
                maxVotes = elections[_electionId].candidates[i].voteCount;
                winnerIdx = int256(i);
            } else if (elections[_electionId].candidates[i].voteCount == maxVotes && maxVotes > 0) {
                // Handle tie-breaking or indicate a tie (for simplicity, first candidate encountered wins tie)
            }
        }

        if (winnerIdx != -1) {
            elections[_electionId].winningCandidateIndex = uint256(winnerIdx);
            elections[_electionId].winningCandidateName = elections[_electionId].candidates[uint256(winnerIdx)].name;
            emit ResultsDeclared(_electionId, elections[_electionId].winningCandidateName);
        } else {
            elections[_electionId].winningCandidateName = "No winner (or no candidates/votes)";
            emit ResultsDeclared(_electionId, elections[_electionId].winningCandidateName);
        }
    }

    // --- Voter Function ---
    function vote(uint256 _electionId, uint256 _candidateIndex) public onlyVoter(_electionId) electionExists(_electionId) electionStartedAndNotEnded(_electionId) notVotedYet(_electionId) {
        require(_candidateIndex < elections[_electionId].candidates.length, "Invalid candidate index.");

        elections[_electionId].candidates[_candidateIndex].voteCount++;
        elections[_electionId].hasVoted[msg.sender] = true;
        elections[_electionId].totalVotesCast++;
        emit VoteCast(_electionId, msg.sender, _candidateIndex);
    }

    // --- Public View Functions (Read-only) ---

    // Get total number of elections created
    function getElectionCount() public view returns (uint256) {
        return nextElectionId; // Still returns the next available ID
    }

    // NEW: Function to get all created election IDs
    function getCreatedElectionIds() public view returns (uint256[] memory) {
        uint256[] memory activeIds = new uint256[](nextElectionId); // Max possible size
        uint256 counter = 0;
        for (uint256 i = 0; i < nextElectionId; i++) {
            if (electionExistsById[i]) { // Check if the election actually exists
                activeIds[counter] = i;
                counter++;
            }
        }
        // Resize the array to the actual number of active IDs
        uint256[] memory result = new uint256[](counter);
        for (uint256 i = 0; i < counter; i++) {
            result[i] = activeIds[i];
        }
        return result;
    }


    // Get summary of a specific election
    function getElectionSummary(uint256 _electionId) public view electionExists(_electionId) returns (string memory name, bool started, bool ended) {
        ElectionData storage election = elections[_electionId];
        return (election.name, election.started, election.ended);
    }

    // Get full status of a specific election
    function getElectionStatus(uint256 _electionId) public view electionExists(_electionId) returns (string memory name, bool started, bool ended, uint256 votesCast) {
        ElectionData storage election = elections[_electionId];
        return (election.name, election.started, election.ended, election.totalVotesCast);
    }

    // Get candidates for a specific election
    function getCandidates(uint256 _electionId) public view electionExists(_electionId) returns (Candidate[] memory) {
        return elections[_electionId].candidates;
    }

    // Get voter status for a specific election
    function getVoterStatus(uint256 _electionId, address _voterAddress) public view electionExists(_electionId) returns (bool isRegistered, bool hasVotedStatus) {
        ElectionData storage election = elections[_electionId];
        return (election.voters[_voterAddress], election.hasVoted[_voterAddress]);
    }

    // Get winner for a specific election
    function getWinner(uint256 _electionId) public view electionExists(_electionId) returns (string memory winnerName) {
        require(elections[_electionId].ended, "Election has not ended yet to get winner.");
        require(bytes(elections[_electionId].winningCandidateName).length > 0, "Results not declared yet.");
        return elections[_electionId].winningCandidateName;
    }
}