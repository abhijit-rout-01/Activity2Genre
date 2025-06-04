async function sendUsername() {
    const usernameInput = document.getElementById("username");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const moviesDiv = document.getElementById("movies");

    const username = usernameInput.value.trim();
    
    if (!username) {
        alert("Please enter a Twitter username.");
        return;
    }

    analyzeBtn.disabled = true;  // Disable button to prevent multiple clicks
    analyzeBtn.innerText = "Analyzing...";

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });

        const movies = await response.json();

        moviesDiv.innerHTML = "";  // Clear previous results

        if (!movies.length) {
            moviesDiv.innerHTML = "<p>No recommendations found.</p>";
            return;
        }

        movies.forEach(movie => {
            const movieDiv = document.createElement("div");
            movieDiv.classList.add("movie");
            movieDiv.dataset.poster = movie.poster_path;
            movieDiv.dataset.title = movie.title;
            movieDiv.dataset.rating = movie.vote_average;

            movieDiv.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
                <h3>${movie.title}</h3>
                <p>⭐ ${movie.vote_average}</p>
            `;

            movieDiv.addEventListener("click", (event) => {
                event.stopPropagation(); // Prevent closing when clicking the movie itself
                expandMovie(movieDiv, movie);
            });

            moviesDiv.appendChild(movieDiv);
        });

        // Add event listener to close expanded movie when clicking outside
        document.addEventListener("click", collapseMovies);
    } catch (error) {
        console.error("Error fetching data:", error);
        moviesDiv.innerHTML = "<p>Error fetching movie recommendations. Please try again later.</p>";
    } finally {
        analyzeBtn.disabled = false;  // Re-enable button
        analyzeBtn.innerText = "Analyze";
    }
}

function expandMovie(movieDiv, movie) {
    // Create modal elements dynamically
    let modalOverlay = document.createElement("div");
    modalOverlay.classList.add("modal-overlay");

    modalOverlay.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <div class="modal-image">
                <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
            </div>
            <div class="modal-details">
                <h2>${movie.title}</h2>
                <p><strong>Release Date:</strong> ${movie.release_date}</p>
                <p><strong>Overview:</strong> ${movie.overview}</p>
                <p class="rating"><strong>Rating:</strong> ⭐ ${movie.vote_average}</p>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    // Show modal with animation
    setTimeout(() => modalOverlay.classList.add("show-modal"), 10);

    // Close modal when clicking the close button
    modalOverlay.querySelector(".close-btn").addEventListener("click", () => {
        modalOverlay.classList.remove("show-modal");
        setTimeout(() => modalOverlay.remove(), 300);
    });

    // Close modal when clicking outside the modal content
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove("show-modal");
            setTimeout(() => modalOverlay.remove(), 300);
        }
    });
}


function collapseMovies() {
    document.querySelectorAll(".movie").forEach(movie => {
        movie.classList.remove("expanded");
        movie.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${movie.dataset.poster}" alt="${movie.dataset.title}">
            <h3>${movie.dataset.title}</h3>
            <p>⭐ ${movie.dataset.rating}</p>
        `;
    });
}
