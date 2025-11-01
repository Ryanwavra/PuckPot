const connectBtn = document.getElementById("connect");
const walletMenu = document.getElementById("wallet-menu");
const walletAddrDiv = document.getElementById("wallet-address");
const disconnectBtn = document.getElementById("disconnect");

// -----------------------------
// 🔧 Network Config
// -----------------------------
const NETWORKS = {
  baseMainnet: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
  },
  baseSepolia: {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
  },
};

// 👉 Toggle this between "baseSepolia" (dev/test) and "baseMainnet" (production)
const ACTIVE_NETWORK = "baseSepolia";

// -----------------------------
// 🔧 Web3Modal setup
// -----------------------------
const providerOptions = {
  walletconnect: {
    package: window.WalletConnectProvider,
    options: {
      rpc: {
        [NETWORKS.baseMainnet.chainId]: NETWORKS.baseMainnet.rpcUrl,
        [NETWORKS.baseSepolia.chainId]: NETWORKS.baseSepolia.rpcUrl,
      },
    },
  },
  coinbasewallet: {
    package: window.CoinbaseWalletSDK,
    options: {
      appName: "PuckPot",
      rpc: NETWORKS[ACTIVE_NETWORK].rpcUrl,
      chainId: NETWORKS[ACTIVE_NETWORK].chainId,
    },
  },
};

const web3Modal = new window.Web3Modal.default({
  cacheProvider: false,
  providerOptions,
});

let web3Provider; // ethers.js provider
let web3Instance; // raw provider instance

// -----------------------------
// 🔧 Helpers
// -----------------------------
function shortenAddress(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

function showConnected(address) {
  connectBtn.textContent = shortenAddress(address);
  connectBtn.classList.add("connected");
  walletAddrDiv.textContent = address;
}

function showDisconnected() {
  connectBtn.textContent = "Connect Wallet";
  connectBtn.classList.remove("connected");
  walletAddrDiv.textContent = "";
  walletMenu.classList.add("hidden");
}

// -----------------------------
// 🔧 Core Functions
// -----------------------------
async function connectWallet() {
  try {
    web3Instance = await web3Modal.connect(); // 🔥 Pops up wallet selector
    web3Provider = new ethers.providers.Web3Provider(web3Instance);
    const signer = web3Provider.getSigner();
    const address = await signer.getAddress();

    showConnected(address);
    localStorage.setItem("connectedAddress", address);

    // Listen for account/network changes
    web3Instance.on("accountsChanged", (accounts) => {
      if (accounts.length > 0) {
        showConnected(accounts[0]);
        localStorage.setItem("connectedAddress", accounts[0]);
      } else {
        disconnectWallet();
      }
    });

    web3Instance.on("chainChanged", () => {
      window.location.reload();
    });
  } catch (err) {
    if (err.code === 4001) {
      console.log("User rejected connection.");
    } else {
      console.error("Connection error:", err);
    }
  }
}

function disconnectWallet() {
  localStorage.removeItem("connectedAddress");
  showDisconnected();
  if (web3Modal) {
    web3Modal.clearCachedProvider();
  }
}

// -----------------------------
// 🔧 Event listeners
// -----------------------------
connectBtn?.addEventListener("click", () => {
  const address = localStorage.getItem("connectedAddress");
  if (address) {
    walletMenu.classList.toggle("hidden");
  } else {
    connectWallet();
  }
});

disconnectBtn?.addEventListener("click", () => {
  disconnectWallet();
  walletMenu.classList.add("hidden");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!connectBtn.contains(e.target) && !walletMenu.contains(e.target)) {
    walletMenu.classList.add("hidden");
  }
});

// On load, restore cached connection if desired
window.addEventListener("DOMContentLoaded", async () => {
  const saved = localStorage.getItem("connectedAddress");
  if (saved) {
    showConnected(saved);
  } else {
    showDisconnected();
  }
});