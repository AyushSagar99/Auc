import { useState, useEffect } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import './index.css';

// Import your canister's interface
import { idlFactory } from '../../declarations/auc_backend';
import { ConnectWallet, useAuth } from "@nfid/identitykit/react";
import { auc_backend } from "../../declarations/auc_backend";

function App() {
  // Use ONLY the useAuth hook for identity management
  const { user } = useAuth();
  
  // const [actor, setActor] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Remove the type annotation that uses 'state'

  // Form states
  const [newAuction, setNewAuction] = useState({
    title: '',
    description: '',
    duration: 3600,
    reservePrice: 100
  });

  const [bidForm, setBidForm] = useState({
    auctionId: '',
    amount: ''
  });

  // Calculate isConnected based on user
  const isConnected = !!user;

  // Log the principal ID when user changes
  useEffect(() => {
    if (user) {
      console.log("Connected with principal:", user.principal.toText());
      
      
      // First initialize the actor with the identity
      initActor(user.identity);
      console.log(user.identity,"aaaa")
    
    } else {
      // Reset state when user disconnects
      setAuctions([]);
      console.log("User disconnected");
    }
  }, [user]);

  // Initialize actor when user changes
  useEffect(() => {
    if (user) {
      initActor(user.identity);
    }
  }, [user]);

  // Initialize canister actor with identity
  const initActor = async (identity) => {
    try {
      setLoading(true);
      
      // Get the host based on environment
      const host = process.env.NODE_ENV === 'production' 
        ? "https://ic0.app" 
        : 'http://localhost:4943';

      console.log("Using host:", host);
      
      const agent = HttpAgent.createSync({ 
        identity, 
        host,
        fetch: window.fetch.bind(window) 
      });
      
      // For local development only
      if (process.env.NODE_ENV !== 'production') {
        await agent.fetchRootKey();
      }
      
      // Get canister ID
      const canisterId = process.env.CANISTER_ID_AUC_BACKEND || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
      console.log("Using canister ID:", canisterId);
      
      console.log("Actor initialized with identity");
      
      // Initial fetch of auctions
      try {
        const activeAuctions = await auc_backend.getActiveAuctions();
        setAuctions(activeAuctions);
        console.log("Fetched auctions:", activeAuctions.length);
      } catch (err) {
        console.error("Failed to fetch auctions:", err);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Actor creation error:", error);
      setError("Failed to connect to the Internet Computer: " + error.message);
      setLoading(false);
    }
  };

  // Fixed updateIdentity function
  const updateIdentity = async () => {
    try {
      if (!user) {
        console.error("No user identity available");
        setError("Authentication failed: No user identity available");
        return;
      }
      
      console.log("Updating identity with principal:", user.principal.toText());
      
      // Update the agent's identity for the backend canister
      Actor.agentOf(auc_backend).replaceIdentity(user.identity);
      
      console.log("Identity updated successfully");
      
      // Fetch auctions with the new identity
      await fetchAuctions();
      
    } catch (error) {
      console.error("Error updating identity:", error);
      setError("Authentication failed: " + error.message);
    }
  };

  // Fetch active auctions
  const fetchAuctions = async () => {
    try {
      setLoading(true);
      console.log("Fetching auctions...");
      const activeAuctions = await auc_backend.getActiveAuctions();
      console.log("Received auctions:", activeAuctions.length);
      setAuctions(activeAuctions);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      setError("Failed to fetch auctions: " + error.message);
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
    
    if (!auc_backend || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      const { title, description, duration, reservePrice } = newAuction;
      
      console.log("Creating auction with:", { title, description, duration, reservePrice });
      console.log("Using principal:", user.principal.toText());
      
      // Create the auction
      const auctionId = await auc_backend.createAuction(title, description, duration, reservePrice);
      console.log("Auction created with ID:", auctionId);
      
      // Reset form
      setNewAuction({
        title: '',
        description: '',
        duration: 3600,
        reservePrice: 100
      });
      
      // Fetch updated auctions
      await fetchAuctions();
      
      setLoading(false);
    } catch (error) {
      console.error("Error creating auction:", error);
      let errorMessage = "Failed to create auction";
      
      // Try to extract a more specific error message
      if (error.message) {
        errorMessage += ": " + error.message;
      }
      
      setError(errorMessage);
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
    
    if (!auc_backend || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      const { auctionId, amount } = bidForm;
      
      // Convert auctionId to a number if it's a string
      const id = typeof auctionId === 'string' ? Number(auctionId) : auctionId;
      
      console.log("Placing bid:", { auctionId: id, amount });
      const result = await auc_backend.placeBid(id, amount);
      console.log("Bid result:", result);
      
      if (result) {
        // Reset form
        setBidForm({
          auctionId: '',
          amount: ''
        });
        
        // Fetch updated auctions
        await fetchAuctions();
      } else {
        setError("Bid was not accepted. Please check auction status and bid amount.");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error placing bid:", error);
      setError("Failed to place bid: " + error.message);
      setLoading(false);
    }
  };

  // End an auction
  const endAuction = async (auctionId) => {
    if (!auc_backend || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      console.log("Ending auction:", auctionId);
      const result = await auc_backend.endAuction(auctionId);
      console.log("End auction result:", result);
      
      if (result && result.length > 0) {
        alert(`Auction ended. Winner: ${result[0].winner.toText()}. Price: ${result[0].price}`);
      } else {
        alert("No winner for this auction.");
      }
      
      // Fetch updated auctions
      await fetchAuctions();
      
      setLoading(false);
    } catch (error) {
      console.error("Error ending auction:", error);
      setError("Failed to end auction: " + error.message);
      setLoading(false);
    }
  };

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    // Convert nanoseconds to milliseconds
    const milliseconds = Number(timestamp) / 1_000_000;
    return new Date(milliseconds).toLocaleString();
  };

  // Check if user is the owner of an auction
  const isOwner = (auction) => {
    if (!user) return false;
    const userPrincipal = user.principal.toText();
    return auction.owner.toText() === userPrincipal;
  };

  return (
    <div className="app-container">
      <header>
        <h1>Vickrey Auction Platform</h1>
        <div className="auth-info">
          {isConnected && <p>Logged in as: {user.principal.toText()}</p>}
          <ConnectWallet />
        </div>
      </header>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

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
            
            <button type="submit" disabled={loading || !isConnected}>
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
            
            <button type="submit" disabled={loading || !isConnected}>
              {loading ? "Placing Bid..." : "Place Bid"}
            </button>
          </form>
        </section>
      </div>

      <section className="auctions-list">
        <h2>Active Auctions</h2>
        <button onClick={fetchAuctions} disabled={loading || !auc_backend}>
          {loading ? "Refreshing..." : "Refresh Auctions"}
        </button>
        
        {loading && !auctions.length ? (
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
                  <p><strong>Owner:</strong> {auction.owner.toText()}</p>
                </div>
                {isConnected && isOwner(auction) && (
                  <button 
                    onClick={() => endAuction(auction.id)}
                    disabled={loading}
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
  );
}

export default App;