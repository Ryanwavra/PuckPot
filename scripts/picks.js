fetch("/api/games")
  .then(res => res.json())
  .then(games => {
    const container = document.querySelector(".games-section");
    const template = document.getElementById("games-template");

    // Clear any old cards (except the hidden template)
    container.querySelectorAll(".game-card:not(#games-template)").forEach(el => el.remove());

    games.forEach(game => {
      // Clone the hidden template
      const clone = template.cloneNode(true);
      clone.style.display = "block";   // make it visible
      clone.removeAttribute("id");     // avoid duplicate IDs

      // Fill in the fields
      clone.querySelector(".game-date-time").textContent = `${game.date} • ${game.time}`;
      clone.querySelector(".game-status").textContent = game.status;
      clone.querySelector(".away-symbol h3").textContent = game.awayTeam;
      clone.querySelector(".home-symbol h3").textContent = game.homeTeam;

      // Append to the section
      container.appendChild(clone);
    });
  })
  .catch(err => console.error("Error fetching NHL games:", err));