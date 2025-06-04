require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs").promises; // Use async fs functions
const fetch = require("node-fetch");
const { spawn } = require("child_process");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BEARER_TOKEN = process.env.BEARER_TOKEN;
const RAPIDAPI_KEY = process.env.RAPIDAPI_TWITTER; 
const TMDB_BEARER_TOKEN = process.env.TMDB_BEARER_TOKEN;

app.post("/analyze", async (req, res) => {
    try {
        console.log("Received request:", req.body);

        const { username } = req.body;
        if (!username) {
            console.error("Error: Username is missing");
            return res.status(400).json({ error: "Username is required" });
        }

        console.log(`Fetching user ID for username: ${username}`);
        const userId = await getUserId(username);
        if (!userId) {
            console.error("Error: User ID not found");
            return res.status(500).json({ error: "User ID not found" });
        }

        console.log(`User ID: ${userId}, Fetching likes and tweets...`);
        await fetchUserLikes(userId);
        await fetchUserTweets(userId);

        console.log("Running Python script for analysis...");
        const preds= await runPythonScript();
        console.log("Python script completed. Predictions:", preds);

        let moviesArray = await getFromTmdb(preds);
        res.json(moviesArray);
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Fetch user ID
async function getUserId(username) {
    const url = `https://twitter293.p.rapidapi.com/user/by/username/${username}`;
    try {
        console.log(`Fetching user ID from: ${url}`);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "x-rapidapi-key": RAPIDAPI_KEY,
                "x-rapidapi-host": "twitter293.p.rapidapi.com",
            },
        });
        const result = await response.json();
        console.log("User ID response:", result);
        return result?.user?.result?.rest_id || null;
    } catch (error) {
        console.error("Error fetching user ID:", error);
        return null;
    }
}

// Fetch user likes
async function fetchUserLikes(userId) {
    const url = `https://twitter293.p.rapidapi.com/user/${userId}/likes?count=20`;
    try {
        console.log(`Fetching user likes from: ${url}`);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "x-rapidapi-key": RAPIDAPI_KEY,
                "x-rapidapi-host": "twitter293.p.rapidapi.com",
            },
        });
        const result = await response.json();
        console.log("User likes response:", result);

        const entries = result?.user?.result?.timeline_v2?.timeline?.instructions?.[1]?.entries || [];
        
        let textData = "";
        entries.forEach(entry => {
            if (Object.keys(entry.content).length === 4) {
                textData += entry.content.itemContent.tweet_results.result.legacy.full_text + "\n";
            }
        });

        console.log("Writing user likes to text.txt...");
        await fs.appendFile("text.txt", textData);
    } catch (error) {
        console.error("Error fetching likes:", error);
    }
}

// Fetch user tweets
async function fetchUserTweets(userId) {
    const url = `https://twitter293.p.rapidapi.com/user/${userId}/tweets?count=100`;
    try {
        console.log(`Fetching user tweets from: ${url}`);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "x-rapidapi-key": RAPIDAPI_KEY,
                "x-rapidapi-host": "twitter293.p.rapidapi.com",
            },
        });
        const result = await response.json();
        console.log("User tweets response:", result);

        const entries = result?.user?.result?.timeline_v2?.timeline?.instructions?.[1]?.entries || [];

        let textData = "";
        entries.forEach(entry => {
            try {
                textData += JSON.stringify(entry.content.itemContent.tweet_results.result.legacy.full_text) + "\n";
            } catch {
                console.log("Tweet not available...");
            }
        });

        console.log("Writing user tweets to text.txt...");
        await fs.writeFile("text.txt", textData);
    } catch (error) {
        console.error("Error fetching tweets:", error);
    }
}

// Run Python script
async function runPythonScript() {
  return new Promise((resolve, reject) => {
    let jsonData = "";
    const pythonProcess = spawn("python", ["F:\\Programs\\twitter-movie-analyzer\\public\\script.py"]);

    pythonProcess.stdout.on("data", (data) => {
        jsonData += data.toString(); // Accumulate the output data
    });

    pythonProcess.stderr.on("data", (data) => {
        console.error(`Python Error: ${data}`);
    });

    pythonProcess.on("close", (code) => {
        if (code !== 0) {
            return reject(`Python script exited with code ${code}`);
        }

        try {
            const arrpy = JSON.parse(jsonData.trim()); // Ensure JSON is valid
            const preds = arrpy.map(value => ({ value })); // Convert to expected format
            console.log("Python script output:", preds);
            resolve(preds);
        } catch (error) {
            reject(`Error parsing Python output: ${error.message}`);
        }
    });

    pythonProcess.on("error", (error) => {
        reject(`Failed to start Python script: ${error.message}`);
    });
  });
}


// Fetch movies from TMDB
async function getFromTmdb(preds_old){
    console.log("Fetching movies from TMDB based on predictions...");
    const preds0=preds_old.map(item=>item.value);
    console.log(preds0);
    let genre_arr = {
        0: ['Romance', 'Drama'],
        1: ['Sci-Fi', 'Fantasy'],
        2: ['Documentary', 'Historical'],
        3: ['Action', 'Comedy'],
        4: ['Thriller', 'Horror']
      };
    
      // Mapping the personality predictions
      let preds1 = { 0: preds0[0], 1: preds0[1], 2: preds0[2], 3: preds0[3], 4: preds0[4] };
    
      // Sorting predictions in ascending order
      const sortedArray = Object.entries(preds1).sort(([, value1], [, value2]) => value1 - value2);
      const preds = Object.fromEntries(sortedArray);
    
      // TMDB API token
      const TMDB = process.env.TMDB_BEARER_TOKEN;
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB}`
        }
      };
    
      // Base URL for TMDB API
      const url = 'https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=';
    
      // Read genre mapping from JSON file
      let genreObj;
      try {
        const data = await fs.readFile('genres.json', 'utf8');
        genreObj = JSON.parse(data);
      } catch (err) {
        console.error("Error reading genre JSON:", err);
        return [];
      }
    
      let moviesArray = [];
    
      // Use a `for...of` loop to handle async calls correctly
      for (const [idx, val] of Object.entries(preds)) {
        let g = `${genreObj['genres'][genre_arr[idx][0]]}|${genreObj['genres'][genre_arr[idx][1]]}`;
    
        try {
          const response = await fetch(url + g, options);
          const responseData = await response.json();
    
          // Validate response data
          if (!responseData.results) {
            console.warn(`No results for genres: ${g}`);
            continue;
          }
    
          let count = Math.ceil(val * responseData.results.length); // Proportional selection
          moviesArray.push(...responseData.results.slice(0, count)); // Add selected movies
        } catch (error) {
          console.error("Error fetching from TMDB:", error);
        }
      }
    
      return moviesArray;
}

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
