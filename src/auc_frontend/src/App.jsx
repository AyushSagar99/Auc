import { useState, useEffect } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';
import './index.css';

// Import your canister's interface
import { idlFactory } from '../../declarations/auc_backend';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authClient, setAuthClient] = useState(null);
  const [actor, setActor] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [newAuction, setNewAuction] = useState({
    title: '',
    description: '',
    duration: 3600, // Default 1 hour
    reservePrice: 100 // Default 100 tokens
  });

  const [bidForm, setBidForm] = useState({
    auctionId: '',
    amount: ''
  });

  // Initialize auth client
  useEffect(() => {
    const initAuth = async () => {
      try {
        const client = await AuthClient.create();
        setAuthClient(client);
        
        const isAlreadyAuthenticated = await client.isAuthenticated();
        if (isAlreadyAuthenticated) {
          const identity = client.getIdentity();
          setIdentity(identity);
          setIsAuthenticated(true);
          initActor(identity);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setError("Failed to initialize authentication");
      }
    };

    initAuth();
  }, []);

  // Initialize canister actor with identity
  const initActor = async (identity) => {
    try {
      // In local development, you need to specify the host
      // In production on IC, you can omit the host option
      const host = process.env.NODE_ENV === 'production' 
        ? undefined 
        : 'http://localhost:4943';
      
      const agent = new HttpAgent({ identity, host });
      
      // Only for local development
      if (process.env.NODE_ENV !== 'production') {
        await agent.fetchRootKey();
      }
      
      // Get your canister ID from the environment
      const canisterId = process.env.CANISTER_ID_AUC_BACKEND || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
      
      // Create actor with the agent
      const actorInstance = Actor.createActor(idlFactory, {
        agent,
        canisterId,
      });
      
      setActor(actorInstance);
      fetchAuctions(actorInstance);
    } catch (error) {
      console.error("Actor creation error:", error);
      setError("Failed to connect to the Internet Computer");
    }
  };

  // Login function
  const login = async () => {
    try {
      // Get the canister ID for Internet Identity directly
      const iiCanisterId = process.env.CANISTER_ID_INTERNET_IDENTITY || 'be2us-64aaa-aaaaa-qaabq-cai';
      
      console.log("Using Internet Identity canister ID:", iiCanisterId);
      
      await authClient.login({
        identityProvider: process.env.NODE_ENV === 'production'
  ? 'https://identity.ic0.app'
  : `http://br5f7-7uaaa-aaaaa-qaaca-cai.localhost:4943`,
        onSuccess: async () => {
          const identity = authClient.getIdentity();
          setIdentity(identity);
          setIsAuthenticated(true);
          initActor(identity);
          console.log("Login successful:", identity.getPrincipal().toText());
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      setError("Failed to login: " + error.message);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authClient.logout();
      setIsAuthenticated(false);
      setIdentity(null);
      setActor(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Fetch active auctions
  const fetchAuctions = async (actorInstance) => {
    try {
      setLoading(true);
      const activeAuctions = await (actorInstance || actor).getActiveAuctions();
      setAuctions(activeAuctions);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      setError("Failed to fetch auctions");
      setLoading(false);
    }
  };

  // Handle form input change for new auction
  const handleAuctionFormChange = (e) => {
    const { name, value } = e.target;
    setNewAuction(prev => ({
      ...prev,
      [name]: name === 'duration' || name === 'reservePrice' ? Number(value) : value
    }));
  };

  // Create a new auction
  const createAuction = async (e) => {
    e.preventDefault();
    if (!actor) return;

    try {
      setLoading(true);
      const { title, description, duration, reservePrice } = newAuction;
      const auctionId = await actor.createAuction(title, description, duration, reservePrice);
      
      // Reset form
      setNewAuction({
        title: '',
        description: '',
        duration: 3600,
        reservePrice: 100
      });
      
      // Fetch updated auctions
      fetchAuctions();
      setLoading(false);
    } catch (error) {
      console.error("Error creating auction:", error);
      setError("Failed to create auction");
      setLoading(false);
    }
  };

  // Handle bid form change
  const handleBidFormChange = (e) => {
    const { name, value } = e.target;
    setBidForm(prev => ({
      ...prev,
      [name]: name === 'amount' ? Number(value) : value
    }));
  };

  // Place a bid
  const placeBid = async (e) => {
    e.preventDefault();
    if (!actor) return;

    try {
      setLoading(true);
      const { auctionId, amount } = bidForm;
      
      // Convert auctionId to a number if it's a string
      const id = typeof auctionId === 'string' ? Number(auctionId) : auctionId;
      
      const result = await actor.placeBid(id, amount);
      
      if (result) {
        // Reset form
        setBidForm({
          auctionId: '',
          amount: ''
        });
        
        // Fetch updated auctions
        fetchAuctions();
      } else {
        setError("Bid was not accepted. Please check auction status and bid amount.");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error placing bid:", error);
      setError("Failed to place bid");
      setLoading(false);
    }
  };

  // End an auction
  const endAuction = async (auctionId) => {
    if (!actor) return;

    try {
      setLoading(true);
      const result = await actor.endAuction(auctionId);
      
      if (result.length > 0) {
        alert(`Auction ended. Winner: ${result[0].winner.toText()}. Price: ${result[0].price}`);
      } else {
        alert("No winner for this auction.");
      }
      
      // Fetch updated auctions
      fetchAuctions();
      setLoading(false);
    } catch (error) {
      console.error("Error ending auction:", error);
      setError("Failed to end auction");
      setLoading(false);
    }
  };

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    // Convert nanoseconds to milliseconds
    const milliseconds = Number(timestamp) / 1_000_000;
    return new Date(milliseconds).toLocaleString();
  };

  // Get user principal ID as string
  const getUserPrincipal = () => {
    if (!identity) return "Not authenticated";
    return identity.getPrincipal().toText();
  };

  // Check if user is the owner of an auction
  const isOwner = (auction) => {
    if (!identity) return false;
    const userPrincipal = identity.getPrincipal().toText();
    return auction.owner.toText() === userPrincipal;
  };

  return (
    <div className="app-container">
      <header>
        <h1>Vickrey Auction Platform</h1>
        {isAuthenticated ? (
          <div className="auth-info">
            <p>Logged in as: {getUserPrincipal()}</p>
            <button onClick={logout}>Logout</button>
          </div>
        ) : (
          <button onClick={login}>Login with Internet Identity</button>
        )}
      </header>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {isAuthenticated ? (
        <div className="content">
          <section className="create-auction">
            <h2>Create New Auction</h2>
            <form onSubmit={createAuction}>
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={newAuction.title}
                  onChange={handleAuctionFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={newAuction.description}
                  onChange={handleAuctionFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="duration">Duration (seconds)</label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="60"
                  value={newAuction.duration}
                  onChange={handleAuctionFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="reservePrice">Reserve Price</label>
                <input
                  type="number"
                  id="reservePrice"
                  name="reservePrice"
                  min="1"
                  value={newAuction.reservePrice}
                  onChange={handleAuctionFormChange}
                  required
                />
              </div>
              
              <button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Auction"}
              </button>
            </form>
          </section>

          <section className="place-bid">
            <h2>Place Bid</h2>
            <form onSubmit={placeBid}>
              <div className="form-group">
                <label htmlFor="auctionId">Auction ID</label>
                <input
                  type="number"
                  id="auctionId"
                  name="auctionId"
                  min="1"
                  value={bidForm.auctionId}
                  onChange={handleBidFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="amount">Bid Amount</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  min="1"
                  value={bidForm.amount}
                  onChange={handleBidFormChange}
                  required
                />
              </div>
              
              <button type="submit" disabled={loading}>
                {loading ? "Placing Bid..." : "Place Bid"}
              </button>
            </form>
          </section>

          <section className="auctions-list">
            <h2>Active Auctions</h2>
            <button onClick={() => fetchAuctions()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Auctions"}
            </button>
            
            {loading ? (
              <p>Loading auctions...</p>
            ) : auctions.length === 0 ? (
              <p>No active auctions found.</p>
            ) : (
              <div className="auctions-grid">
                {auctions.map((auction) => (
                  <div key={auction.id} className="auction-card">
                    <h3>{auction.title}</h3>
                    <p>{auction.description}</p>
                    <div className="auction-details">
                      <p><strong>ID:</strong> {auction.id.toString()}</p>
                      <p><strong>Reserve Price:</strong> {auction.reservePrice.toString()}</p>
                      <p><strong>Starts:</strong> {formatDate(auction.startTime)}</p>
                      <p><strong>Ends:</strong> {formatDate(auction.endTime)}</p>
                      <p><strong>Status:</strong> {Object.keys(auction.state)[0]}</p>
                    </div>
                    {isOwner(auction) && (
                      <button 
                        onClick={() => endAuction(auction.id)}
                        disabled={loading}
                        className="end-auction-btn"
                      >
                        End Auction
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="welcome-message">
          <h2>Welcome to Vickrey Auction Platform</h2>
          <p>Please login to create or bid on auctions.</p>
        </div>
      )}
    </div>
  );
}

export default App;