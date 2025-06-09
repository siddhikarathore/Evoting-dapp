import React from 'react';
import { Navbar, Nav, Button, Container } from 'react-bootstrap';

function AppNavbar({ currentAccount, connectWallet, userRole }) {
    return (
        <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 rounded-b-lg shadow-lg">
            <Container>
                <Navbar.Brand href="#home" className="text-white font-bold text-xl">E-Voting DApp</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
                    <Nav>
                        {currentAccount ? (
                            <>
                                <Navbar.Text className="text-white me-3 d-flex align-items-center">
                                    Connected: <strong className="ms-2">{currentAccount.substring(0, 6)}...{currentAccount.substring(currentAccount.length - 4)}</strong>
                                </Navbar.Text>
                                <Navbar.Text className="text-white d-flex align-items-center">
                                    Role: <strong className="ms-2">{userRole || 'Not Selected'}</strong>
                                </Navbar.Text>
                            </>
                        ) : (
                            <Button
                                variant="outline-light"
                                onClick={connectWallet}
                                className="rounded-md px-4 py-2 hover:bg-gray-700 transition-colors"
                            >
                                Connect Wallet
                            </Button>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default AppNavbar;