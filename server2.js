require("dotenv").config(); // Load environment variables

const express = require("express");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const {stringify} = require('flatted')
const {spawn} = require('child_process');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BEARER_TOKEN = process.env.BEARER_TOKEN; // Load token from .env

app.post("/analyze", async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: "Username is required" });
        }
        //console.log(username);
        //userbyusername
        const url = `https://twitter293.p.rapidapi.com/user/by/username/${username}`;
        const options = {
          method: 'GET',
          headers: {
            'x-rapidapi-key': '3e73f7c906msh50a167e69be03edp1e0e06jsnc4f8ccc0b7b5',
            'x-rapidapi-host': 'twitter293.p.rapidapi.com'
          }
        };

        try {
          const response = await fetch(url, options);
          const result = await response.json();
          const userId=result['user']['result']['rest_id'];
          //console.log(userId);
          //userLikes
          const url1 = `https://twitter293.p.rapidapi.com/user/${userId}/likes?count=20`;
          const options1 = {
            method: 'GET',
            headers: {
              'x-rapidapi-key': '3e73f7c906msh50a167e69be03edp1e0e06jsnc4f8ccc0b7b5',
              'x-rapidapi-host': 'twitter293.p.rapidapi.com'
            }
          };

          try {
            const response1 = await fetch(url1, options1);
            const result1 = await response1.json();
            arr=result1['user']['result']['timeline_v2']['timeline']['instructions']['1']['entries'];
            arr.forEach(index => {
              if(Object.keys(index['content']).length==4){
                text=index['content']['itemContent']['tweet_results']['result']['legacy']['full_text'];
                fs.appendFileSync('text.txt',text);
              }
            });
          } catch (error) {
            console.log("Cant get likes");
          }

          //usertweets
          const url2 = `https://twitter293.p.rapidapi.com/user/${userId}/tweets?count=100`;
          const options2 = {
            method: 'GET',
            headers: {
              'x-rapidapi-key': '3e73f7c906msh50a167e69be03edp1e0e06jsnc4f8ccc0b7b5',
              'x-rapidapi-host': 'twitter293.p.rapidapi.com'
            }
          };

          try {
            const response2 = await fetch(url2, options2);
            const result2 = await response2.json();
            //console.log(result2['user']['result']['timeline_v2']['timeline']['instructions']);
            arr=result2['user']['result']['timeline_v2']['timeline']['instructions']['1']['entries'];
            arr.forEach(index=>{
              try{
                //console.log(index['content']['itemContent']['tweet_results']['result']);
                text=JSON.stringify(index['content']['itemContent']['tweet_results']['result']['legacy']['full_text']);
                //console.log(text);
                fs.appendFileSync('text.txt',text+"\n");
              }catch{
                console.log("not avail...");
              }
            });
          } catch (error) {
            console.log(error);
          }

          try  {
            let jsonData='';
            const pythonProcess = spawn("python", ["F:\\Programs\\twitter-movie-analyzer\\public\\script.py"]);
            pythonProcess.stdout.on("data", (data) => {
              jsonData=data.toString();
            });
            let preds=[];
            pythonProcess.stdout.on("end", (data) => {
              const arrpy=JSON.parse(jsonData);
              const jsonObj={values:arrpy};
              preds=arrpy.map(value => ({ value }));
            });
            pythonProcess.stderr.on("data", (data) => {
                console.error(`Python Error: ${data}`);
            });
            pythonProcess.on("close", (code) => {
                console.log(`Python script exited with code ${code}`);

                    
                let moviesArray=getFromTmdb(preds);
                res.json(moviesArray);     
            });

          }catch(error){
            console.log(error);
          }
        } catch (error) {
          console.log("Cant get UserId");
        }

    }catch (error) {
        console.error("Error fetching", error);
        res.status(500).json({ error: "Failed" });
    }
});

async function getFromTmdb(preds_old) {
  // Personality trait mapping to genres
  let genre_arr = {
    0: ['Romance', 'Drama'],
    1: ['Sci-Fi', 'Fantasy'],
    2: ['Documentary', 'Historical'],
    3: ['Action', 'Comedy'],
    4: ['Thriller', 'Horror']
  };

  // Mapping the personality predictions
  let preds1 = { 0: preds_old[0], 1: preds_old[1], 2: preds_old[2], 3: preds_old[3], 4: preds_old[4] };

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
    const data = await fs.readFile('data.json', 'utf8');
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
