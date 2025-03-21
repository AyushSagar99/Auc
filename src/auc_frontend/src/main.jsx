import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import "@nfid/identitykit/react/styles.css"
 
import { IdentityKitProvider } from "@nfid/identitykit/react"
import { IdentityKitAuthType } from '@nfid/identitykit';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IdentityKitProvider
      authType={IdentityKitAuthType.DELEGATION}
      signerClientOptions={{
        targets: ["bkyz2-fmaaa-aaaaa-qaaaq-cai"] // **IMPORTANT**: these are *your* canisters, not ledger canisters
      }}>
    <App />
    </IdentityKitProvider>
  </React.StrictMode>,
);
