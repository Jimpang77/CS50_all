# Apocalypse Survivor: The Lab

#### Video Demo: https://youtu.be/uiEkIqvYaiM

#### Description:

Apocalypse Survivor: The Lab is a browser-based, top-down survival game I built for my final project. The main goal is simple: survive as long as you can against waves of mutant enemies, dodge attacks, and take down bosses that spawn as the game progresses. 

I built the entire thing from scratch using HTML5 Canvas, CSS3, and vanilla JavaScript. I didn't want to rely on heavy game engines like Unity or Godot because I really wanted to understand how game loops, collision detection, and rendering work under the hood. The gameplay loop forces you to keep moving, aim carefully, and make quick decisions about which upgrades to pick when you level up. Speaking of upgrades, I added a randomized RPG-style progression system. Every time you collect enough XP orbs to level up, the game pauses and gives you a choice of random upgrades (like piercing bullets, faster fire rate, or plasma auras) based on different rarity tiers.

### Project Structure & File Breakdown

I tried to keep the project structure as clean and manageable as possible, so I split the core logic across three main files:

* `index.html`: This file is intentionally pretty bare-bones. It sets up the main `game-container` and the `<canvas>` element where all the actual game rendering happens. Besides the canvas, it also holds the HTML for all the UI screens (the start menu, the level-up selection screen, the game over screen, etc.). I decided to put these in the HTML and just hide them with CSS until they're needed, which felt a lot smoother than trying to generate UI elements on the fly with JavaScript.

* `style.css`: This handles everything visual outside of the game canvas itself. I went with a dark mode theme to fit the "lab breakout" vibe. I used Flexbox to make sure the game container stays centered no matter the screen size. The CSS also handles the styling for the upgrade cards on the level-up screen, including hover effects and making sure the text wraps properly so it doesn't break the layout if an upgrade description is a bit too long.

* `game.js`: This is the biggest file and where the actual game engine lives. It uses a `requestAnimationFrame` loop to constantly clear and redraw the canvas (hopefully at 60 frames per second). This file tracks the player's WASD movement, figures out where the mouse is pointing for aiming, and handles all the math for bullet trajectories and enemy pathfinding. It also manages arrays for all active entities on the screen (bullets, enemies, particles, XP orbs) and runs the collision detection to see if anything is hitting anything else.

### Design Choices

I ran into a lot of roadblocks while building this, and had to make a few major design decisions to keep the game playable and performant:

**1. Using Canvas over DOM elements**
Originally, I thought about just using absolute-positioned HTML `<div>` elements for the player and the enemies. But I quickly realized that once I had 50 or 100 enemies on screen, updating the DOM that many times per second was going to completely tank the browser's performance. Switching to the HTML5 Canvas API solved this. It basically just draws pixels and forgets about them, which let me put way more enemies and particle effects on screen without lagging.

**2. The State Machine**
Game states are notoriously messy. I started out with a bunch of boolean variables like `isPaused`, `isDead`, and `isLevelingUp`, but they kept conflicting and causing bugs (like enemies still moving behind the level-up screen). I fixed this by implementing a simple State Machine pattern. I created a `STATE` object (START, PLAYING, LEVEL_UP, GAME_OVER). Now, the main game loop just checks the current state. If the state is `LEVEL_UP`, it literally just skips the function that moves the enemies and bullets, safely pausing the game.

**3. Object-Oriented Enemies**
To avoid repeating my code a hundred times, I used JavaScript classes. I built one main `Enemy` class that handles the basic stuff: moving toward the player, taking damage, and dying. Then, I just extended that class to make specific enemy types. For example, the `SporeSpitter` class inherits all the basic movement but adds a custom function to shoot projectiles. This made it super easy to add new enemies late in development.

**4. Static Map Boundaries**
I debated making the map randomly generated, but I realized that a top-down shooter is actually more fun if you have choke points. I created an array of static, solid building objects. This forces the player to navigate tight spaces and use the environment to funnel enemies. It also meant I had to write a custom function to make sure XP orbs and loot wouldn't spawn inside a solid wall, which was a fun little math challenge to solve.

Overall, I'm really proud of how this turned out. Building an entire game engine from scratch in vanilla JavaScript taught me more about performance and code organization than any other project I've worked on.