// frontend/src/components/RoleSelection.js

import React from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap';

function RoleSelection({ onSelectRole }) {
    return (
        <Card className="my-5 p-5 text-center shadow-lg rounded-lg max-w-md mx-auto">
            <Card.Body>
                <h2 className="mb-4 text-primary font-bold">Select Your Role</h2>
                <p className="text-secondary mb-4">Please choose how you intend to interact with the E-Voting DApp.</p>
                <Row className="justify-content-center gap-3">
                    <Col xs={12} md={5}>
                        <Button
                            variant="dark"
                            size="lg"
                            className="w-full py-3 rounded-md shadow-md hover:scale-105 transition-transform"
                            onClick={() => onSelectRole('Admin')}
                        >
                            I am an Admin
                        </Button>
                    </Col>
                    <Col xs={12} md={5}>
                        <Button
                            variant="info"
                            size="lg"
                            className="w-full py-3 rounded-md shadow-md hover:scale-105 transition-transform"
                            onClick={() => onSelectRole('Voter')}
                        >
                            I am a Voter
                        </Button>
                    </Col>
                </Row>
                <p className="mt-4 text-muted text-sm">
                    Your wallet address will be checked against the blockchain to confirm your authorization for the selected role.
                </p>
            </Card.Body>
        </Card>
    );
}

export default RoleSelection;