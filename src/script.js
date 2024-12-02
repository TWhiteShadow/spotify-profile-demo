const clientId = "09120fc446ff4c2ea6ad0631190d73e9";
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (localStorage.getItem("accessToken") && isValid()) {
    const profile = await fetchProfile(localStorage.getItem("accessToken"));
    console.log('HERE IS THE PROFILE', profile);

    const playlist = await fetchPlaylists(localStorage.getItem("accessToken"));
    console.log('HERE IS THE PLAYLIST', playlist);
    populatePlaylists(playlist);

    if (profile.error && profile.error.status === 401) {
        localStorage.removeItem("accessToken");
        redirectToAuthCodeFlow(clientId);
    }
    populateUI(profile);
} else if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    const accessToken = await getAccessToken(clientId, code);
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("accessTokenTimestamp", Date.now());
    const profile = await fetchProfile(accessToken);
    console.log(profile); // Profile data logs to console
    populateUI(profile);
}

function isValid() {
    if (localStorage.getItem("accessTokenTimestamp") > Date.now() - 3600 * 1000) {
        return true;
    } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("accessTokenTimestamp");
        return false;
    }
}

export async function redirectToAuthCodeFlow(clientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("scope", "user-read-private user-read-email user-follow-read");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function getAccessToken(clientId, code) {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("code_verifier", verifier);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();
    return access_token;
}

async function fetchProfile(token) {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

function populateUI(profile) {
    document.getElementById("displayName").innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(300, 300);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar").appendChild(profileImage);
    }
    document.getElementById("id").innerText = profile.id;
    document.getElementById("email").innerText = profile.email;
    document.getElementById("uri").innerText = profile.uri;
    document.getElementById("uri").setAttribute("href", profile.external_urls.spotify);
    document.getElementById("url").innerText = profile.href;
    document.getElementById("url").setAttribute("href", profile.href);
}

async function fetchPlaylists(token) {
    const result = await fetch("https://api.spotify.com/v1/me/following?type=artist&limit=12", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}

function populatePlaylists(playlists) {
    console.log('HERE ARE PLAYLISTS', playlists);
    playlists.artists.items.forEach(playlist => {
        const playlistItem = document.createElement("li");
        const text = document.createElement("span");
        text.innerText = playlist.name;
        playlistItem.appendChild(text);

        const playlistLink = document.createElement("a");
        playlistLink.href = playlist.external_urls.spotify;
        playlistLink.target = "_blank";

        const playlistImage = new Image(200, 200);
        playlistImage.src = playlist.images[0].url;

        playlistLink.appendChild(playlistImage);
        playlistItem.appendChild(playlistLink);
        document.getElementById("playlistsList").appendChild(playlistItem);
    });
}

// IFRAME API
window.onSpotifyIframeApiReady = (IFrameAPI) => {
    const element = document.getElementById('embed-iframe');
    const options = {
        width: '100%',
        height: '160',
        uri: "https://open.spotify.com/track/0lUjvjbXRkfCI3OeQZcXKj?si=81a177c69a6e4ecb"
    };
    const callback = (EmbedController) => {
        document.querySelectorAll('.episode').forEach(
            episode => {
                episode.addEventListener('click', () => {
                    EmbedController.loadUri(episode.dataset.spotifyId);
                });
            });
    };
    IFrameAPI.createController(element, options, callback);
};

let debounceTimeout;

document.getElementById("search").addEventListener("input", () => {
    clearTimeout(debounceTimeout); // Clear the previous timeout

    debounceTimeout = setTimeout(async () => {
        const search = document.getElementById("search").value;
        if (search.length == 0) {
            document.getElementById("searchResults").innerHTML = "";
            document.getElementById("searchResultsNumber").innerText = "";
            return;
        }
        const accessToken = localStorage.getItem("accessToken");
        const result = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(search)}&type=track&limit=6`, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const { tracks } = await result.json();
        console.log(tracks.items);
        document.getElementById("searchResults").innerHTML = "";
        document.getElementById("searchResultsNumber").innerText = "Results found : " + tracks.items.length;
        tracks.items.forEach(track => {
            const trackItem = document.createElement("li");
            const text = document.createElement("span");
            text.innerText = track.artists[0].name;
            trackItem.appendChild(text);

            const trackLink = document.createElement("a");
            trackLink.href = track.external_urls.spotify;
            trackLink.target = "_blank";

            const trackImage = new Image(200, 200);
            trackImage.src = track.album.images[0].url;

            trackLink.appendChild(trackImage);
            trackItem.appendChild(trackLink);
            document.getElementById("searchResults").appendChild(trackItem);
        });

        let trackUrl = tracks.items[0].external_urls.spotify;
        console.log('original : ', trackUrl);
        const newTrackUrl = trackUrl.replace("https://open.spotify.com/track/", "https://open.spotify.com/embed/track/");
        console.log('new : ',newTrackUrl);

        document.querySelector("iframe").src = newTrackUrl;

        
    }, 500);
});
