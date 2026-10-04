// ==========================================
// CONFIGURATION & GAME STATE
// ==========================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// Fix for High DPI / Retina displays so it doesn't look blurry
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
}
resizeCanvas();

const STATE = { START: 'START', PLAYING: 'PLAYING', LEVEL_UP: 'LEVEL_UP', CUTSCENE: 'CUTSCENE', GAMEOVER: 'GAMEOVER', VICTORY: 'VICTORY' };
let gameState = STATE.START;

let keys = {};
let mouse = { x: 0, y: 0 };
let particles = [];
let bullets = [];
let enemyProjectiles = [];
let poisonClouds = [];
let enemies = [];
let xpOrbs = [];
let items = [];
let mapBuildings = [];
let dashGhosts = [];

let kills = 0;
let currentStageIndex = 0;
let currentWave = 1;
let waveTimer = 0;
let spawnTimer = 0;
let bossSpawned = false;

let regenTimer = 0;
let screenShake = 0;
let chosenCharacter = null;

// ==========================================
// CUTSCENE ENGINE
// ==========================================
let cutscene = { active: false, text: "", display: "", speaker: "", idx: 0, timer: 0, callback: null };

function startCutscene(text, speaker, callback) {
    gameState = STATE.CUTSCENE;
    cutscene.active = true; cutscene.text = text; cutscene.display = ""; cutscene.speaker = speaker; cutscene.idx = 0; cutscene.timer = 0; cutscene.callback = callback;
}

function updateCutscene(dt) {
    cutscene.timer += dt;
    if (cutscene.timer > 30 && cutscene.idx < cutscene.text.length) {
        cutscene.display += cutscene.text[cutscene.idx];
        cutscene.idx++;
        cutscene.timer = 0;
    }
}

function drawCutscene() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    let boxH = 160, boxY = GAME_HEIGHT - boxH;
    ctx.fillStyle = "rgba(10, 10, 15, 0.95)"; ctx.fillRect(0, boxY, GAME_WIDTH, boxH);
    ctx.strokeStyle = "#00ffcc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, boxY); ctx.lineTo(GAME_WIDTH, boxY); ctx.stroke();

    ctx.fillStyle = "#00ffcc"; ctx.font = "bold 22px monospace"; ctx.textAlign = "left";
    ctx.fillText(cutscene.speaker + " :", 40, boxY + 40);

    ctx.fillStyle = "#ffffff"; ctx.font = "18px monospace";
    let lines = cutscene.display.split('\n');
    lines.forEach((line, i) => { ctx.fillText(line, 40, boxY + 80 + (i * 28)); });

    if (cutscene.idx >= cutscene.text.length) {
        ctx.fillStyle = (Math.floor(Date.now() / 500) % 2 === 0) ? "#00ffcc" : "transparent";
        ctx.font = "bold 16px monospace"; ctx.fillText("▶ CLICK TO CONTINUE", GAME_WIDTH - 240, GAME_HEIGHT - 30);
    }
    ctx.restore();
}
function skipOrEndCutscene() {
    // If the text is still typing out, clicking skips to the end of the text
    if (cutscene.idx < cutscene.text.length) {
        cutscene.idx = cutscene.text.length;
        cutscene.display = cutscene.text;
    }
    // If the text is done typing, clicking ends the cutscene
    else {
        cutscene.active = false;

        // Unpause the game by switching the state back to PLAYING
        gameState = STATE.PLAYING;

        // Run the callback if one was provided (e.g., to spawn the boss and shake the screen)
        if (cutscene.callback) {
            cutscene.callback();
        }
    }
}

// ==========================================
// PLAYER WEAPON & DASH SKILLS PROPERTIES
// ==========================================
const playerWeapon = {
    name: "Custom Pistol", damage: 25, fireRate: 400, bulletSpeed: 5, spread: 0.1,
    projectiles: 1, pierce: 1, bounceCount: 0, color: "#00ffff",
    damageLvl: 1, fireRateLvl: 1, multishotLvl: 1, bounceLvl: 0, auraLvl: 0,
    vampireLvl: 0, pierceLvl: 1, maxHpLvl: 1, speedLvl: 1, magnetLvl: 1,
    regenLvl: 0, dashDmgLvl: 0, bSpeedLvl: 1, spreadLvl: 1, critLvl: 0, iFrameLvl: 1, xpGainLvl: 1
};

const dashSkill = {
    // HALVED DISTANCE: Changed speedMultiplier from 4.5 to 2.25
    cooldown: 4000, duration: 450, speedMultiplier: 2.25, lastUsed: 0, isActive: false,
    timer: 0, vx: 0, vy: 0, level: 1, invincibleLvl: 0
};

const STAGES = [
    { name: "Abandoned Town", bgColor: "#161513", wallColor: "#2c2825", outlineColor: "#423c38", enemyTypes: ["walker", "runner"], startWave: 1, endWave: 10 },
    { name: "Dark Forest", bgColor: "#090d07", wallColor: "#172112", outlineColor: "#23331b", enemyTypes: ["walker", "crawler", "runner"], startWave: 11, endWave: 20 },
    { name: "Military Base", bgColor: "#111316", wallColor: "#22272e", outlineColor: "#333b47", enemyTypes: ["walker", "crawler", "brute", "runner"], startWave: 21, endWave: 35 },
    { name: "Secret Laboratory", bgColor: "#060a0c", wallColor: "#0f1a21", outlineColor: "#00ff66", enemyTypes: ["walker", "crawler", "brute", "mutant"], startWave: 36, endWave: 999 }
];

// ==========================================
// PLAYER MOVEMENT & COLLISION
// ==========================================
const player = {
    x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 15, speed: 3.5, hp: 3, maxHp: 3,
    level: 1, xp: 0, xpNeeded: 10,
    lastShotTime: 0, speedMod: 1.0, magnetRange: 85, magnetActive: false, auraVisualAngle: 0,
    iFrames: 0, baseIFrameDuration: 800, xpMultiplier: 1.0, critChance: 0.0,

    update(dt) {
        if (this.iFrames > 0) this.iFrames -= dt;

        if (playerWeapon.regenLvl > 0 && this.hp < this.maxHp) {
            regenTimer += dt;
            let targetCooldown = Math.max(6000, 20000 - (playerWeapon.regenLvl * 3000));
            if (regenTimer >= targetCooldown) {
                regenTimer = 0; this.hp++;
                createBloodSplatter(this.x, this.y, "#00ffcc", 6);
            }
        } else { regenTimer = 0; }

        if (dashSkill.isActive) {
            dashSkill.timer -= dt;
            this.x += dashSkill.vx; this.y += dashSkill.vy;

            if (Math.random() < 0.5) dashGhosts.push({ x: this.x, y: this.y, alpha: 0.8 });

            if (dashSkill.timer <= 0) {
                dashSkill.isActive = false;
            }
        } else {
            let dx = 0, dy = 0;
            if (keys['w'] || keys['W'] || keys['ArrowUp']) dy -= 1;
            if (keys['s'] || keys['S'] || keys['ArrowDown']) dy += 1;
            if (keys['a'] || keys['A'] || keys['ArrowLeft']) dx -= 1;
            if (keys['d'] || keys['D'] || keys['ArrowRight']) dx += 1;

            if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

            let moveSpeed = this.speed * this.speedMod;
            this.x += dx * moveSpeed;
            this.y += dy * moveSpeed;

            if (keys[' '] && Date.now() - dashSkill.lastUsed >= dashSkill.cooldown && (dx !== 0 || dy !== 0)) {
                dashSkill.isActive = true;
                dashSkill.timer = dashSkill.duration;
                dashSkill.lastUsed = Date.now();
                dashSkill.vx = dx * (moveSpeed * dashSkill.speedMultiplier / 3.5);
                dashSkill.vy = dy * (moveSpeed * dashSkill.speedMultiplier / 3.5);
                if (dashSkill.invincibleLvl > 0) this.iFrames = dashSkill.duration + 200;
            }
        }

        mapBuildings.forEach(b => {
            if (this.x + this.radius > b.x && this.x - this.radius < b.x + b.w &&
                this.y + this.radius > b.y && this.y - this.radius < b.y + b.h) {
                let fromLeft = Math.abs((this.x + this.radius) - b.x);
                let fromRight = Math.abs((this.x - this.radius) - (b.x + b.w));
                let fromTop = Math.abs((this.y + this.radius) - b.y);
                let fromBottom = Math.abs((this.y - this.radius) - (b.y + b.h));

                let minDist = Math.min(fromLeft, fromRight, fromTop, fromBottom);
                if (minDist === fromLeft) this.x = b.x - this.radius;
                else if (minDist === fromRight) this.x = b.x + b.w + this.radius;
                else if (minDist === fromTop) this.y = b.y - this.radius;
                else if (minDist === fromBottom) this.y = b.y + b.h + this.radius;
            }
        });

        this.x = Math.max(this.radius, Math.min(GAME_WIDTH - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(GAME_HEIGHT - this.radius, this.y));

        if (playerWeapon.auraLvl > 0) {
            this.auraVisualAngle += 0.04;
            if (Math.random() < 0.08) {
                let auraRadius = 45 + (playerWeapon.auraLvl * 15);
                let randAngle = Math.random() * Math.PI * 2;
                particles.push(new Particle(this.x + Math.cos(randAngle) * auraRadius, this.y + Math.sin(randAngle) * auraRadius, chosenCharacter?.color || "#00ffff"));
            }
            let auraRadius = 45 + (playerWeapon.auraLvl * 15);
            enemies.forEach(e => {
                if (Math.hypot(e.x - this.x, e.y - this.y) < auraRadius + e.radius) e.hp -= (0.35 * playerWeapon.auraLvl);
            });
        }
    },

    draw() {
        let playerColor = chosenCharacter?.color || "#ffffff";

        if (playerWeapon.auraLvl > 0) {
            let auraRadius = 45 + (playerWeapon.auraLvl * 15);
            let orbCount = 2 + playerWeapon.auraLvl;

            ctx.save();
            ctx.translate(this.x, this.y);

            ctx.strokeStyle = playerColor;
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, auraRadius, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1.0;

            for (let i = 0; i < orbCount; i++) {
                let angle = this.auraVisualAngle + (i * (Math.PI * 2 / orbCount));
                let ox = Math.cos(angle) * auraRadius;
                let oy = Math.sin(angle) * auraRadius;

                ctx.fillStyle = playerColor;
                ctx.shadowBlur = 15;
                ctx.shadowColor = playerColor;
                ctx.beginPath();
                ctx.arc(ox, oy, 5 + (playerWeapon.auraLvl), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.iFrames > 0 && Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.4;

        let angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        ctx.rotate(angle);

        ctx.fillStyle = playerColor;
        ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.quadraticCurveTo(14, -10, 12, -10);
        ctx.lineTo(-12, -10); ctx.quadraticCurveTo(-14, -10, -12, -6); ctx.fill();
        ctx.fillRect(-12, -6, 24, 16);

        ctx.fillStyle = "#333333"; ctx.fillRect(10, -3, 20, 6);
        ctx.fillStyle = "#fcdcae"; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000000"; ctx.beginPath(); ctx.arc(-4, -2, 1.5, 0, Math.PI * 2); ctx.arc(4, -2, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    },

    gainXP(amount) {
        this.xp += (amount * this.xpMultiplier);
        if (this.xp >= this.xpNeeded) {
            this.xp -= this.xpNeeded; this.level++;
            // EASIER LEVELING: Reduced the math multiplier for XP needed
            this.xpNeeded = Math.floor(this.xpNeeded * (1.08 + (this.level * 0.01))) + 15;
            screenShake = 10;
            for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, ["#ffcc00", "#ffffff", "#00ffff"][Math.floor(Math.random()*3)]));
            triggerLevelUp();
        }
    },

    takeDamage(amount = 1) {
        if (dashSkill.isActive || this.iFrames > 0) return;
        this.hp -= amount; this.iFrames = this.baseIFrameDuration;
        screenShake = 12;
        createBloodSplatter(this.x, this.y, "#ff3333", 25);
        if (this.hp <= 0) { this.hp = 0; endGame(); }
    }
};

// ==========================================
// ENVIRONMENT & MECHANICS
// ==========================================
function generateSolidBuildings() {
    mapBuildings = [];
    const structures = [
        { x: 80,  y: 80,  w: 120, h: 100 }, { x: 600, y: 80,  w: 120, h: 100 },
        { x: 80,  y: 420, w: 120, h: 100 }, { x: 600, y: 420, w: 120, h: 100 },
        { x: 260, y: 60,  w: 280, h: 50 },  { x: 260, y: 490, w: 280, h: 50 }
    ];
    structures.forEach(struct => mapBuildings.push(struct));
}

// NEW FUNCTION: Fixes items spawning inside buildings
function getValidDropLocation(startX, startY) {
    let validX = startX;
    let validY = startY;

    mapBuildings.forEach(b => {
        if (validX > b.x && validX < b.x + b.w && validY > b.y && validY < b.y + b.h) {
            let distLeft = validX - b.x;
            let distRight = (b.x + b.w) - validX;
            let distTop = validY - b.y;
            let distBottom = (b.y + b.h) - validY;

            let minDist = Math.min(distLeft, distRight, distTop, distBottom);
            if (minDist === distLeft) validX = b.x - 12;
            else if (minDist === distRight) validX = b.x + b.w + 12;
            else if (minDist === distTop) validY = b.y - 12;
            else if (minDist === distBottom) validY = b.y + b.h + 12;
        }
    });

    // Ensure it doesn't get pushed completely off-screen
    validX = Math.max(10, Math.min(GAME_WIDTH - 10, validX));
    validY = Math.max(10, Math.min(GAME_HEIGHT - 10, validY));

    return { x: validX, y: validY };
}

function drawGridBackground() {
    ctx.strokeStyle = "rgba(0, 255, 100, 0.03)"; ctx.lineWidth = 1; let gridSize = 40;
    ctx.beginPath();
    for (let x = 0; x < GAME_WIDTH; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); }
    for (let y = 0; y < GAME_HEIGHT; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); }
    ctx.stroke();
}

function drawBuildings() {
    let stage = STAGES[currentStageIndex];
    mapBuildings.forEach(b => {
        ctx.fillStyle = stage.wallColor; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = stage.outlineColor; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = "rgba(255, 200, 0, 0.6)";
        let wS = Math.min(b.w / 4, b.h / 3), cols = Math.floor(b.w / (wS + 8)), rows = Math.floor(b.h / (wS + 8));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let wx = b.x + 8 + c * (wS + 8), wy = b.y + 8 + r * (wS + 8);
                ctx.fillRect(wx, wy, wS, wS); ctx.strokeStyle = stage.outlineColor; ctx.lineWidth = 1; ctx.strokeRect(wx, wy, wS, wS);
            }
        }
    });
}

class PoisonGas {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 60; this.timer = 0; this.life = 8000; this.tick = 0;
    }
    update(dt) {
        this.timer += dt; this.tick += dt;
        if (this.tick > 2000) {
            if (Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius) {
                player.takeDamage(1);
            }
            this.tick = 0;
        }
    }
    draw() {
        ctx.save();
        let alpha = 1 - (this.timer / this.life);
        ctx.globalAlpha = Math.max(0, alpha * 0.5);
        ctx.fillStyle = "#33ff33";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// ==========================================
// PROJECTILES & PARTICLES
// ==========================================
class Bullet {
    constructor(x, y, angle) {
        this.x = x; this.y = y;
        this.angle = angle + (Math.random() - 0.5) * playerWeapon.spread;
        this.speed = playerWeapon.bulletSpeed;
        this.damage = playerWeapon.damage;
        this.isCrit = Math.random() < player.critChance;
        if (this.isCrit) this.damage *= 2;
        this.pierce = playerWeapon.pierce;
        this.bouncesLeft = playerWeapon.bounceCount;
        this.radius = this.isCrit ? 6 : 4;
        this.markedForDeletion = false;
        this.color = chosenCharacter?.color || "#00ffff";
    }
    update() {
        this.x += Math.cos(this.angle) * this.speed; this.y += Math.sin(this.angle) * this.speed;

        if (Math.random() < 0.3) {
            let trail = new Particle(this.x, this.y, this.isCrit ? "#ffea00" : this.color);
            trail.radius *= 0.6; trail.vx *= 0.2; trail.vy *= 0.2;
            particles.push(trail);
        }

        if (this.bouncesLeft > 0) {
            if (this.x < 0 || this.x > GAME_WIDTH) { this.angle = Math.PI - this.angle; this.bouncesLeft--; }
            if (this.y < 0 || this.y > GAME_HEIGHT) { this.angle = -this.angle; this.bouncesLeft--; }
        } else {
            if (this.x < 0 || this.x > GAME_WIDTH || this.y < 0 || this.y > GAME_HEIGHT) this.markedForDeletion = true;
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.shadowBlur = this.isCrit ? 20 : 12;
        ctx.shadowColor = this.isCrit ? "#ffea00" : this.color;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class EnemyProjectile {
    constructor(x, y, angle, speed, isSpore = false, tracking = false) {
        this.x = x; this.y = y; this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.speed = speed;
        this.radius = isSpore ? 10 : 6; this.markedForDeletion = false;
        this.isSpore = isSpore;
        this.tracking = tracking;
        this.hp = isSpore ? 1 : 0;
    }
    update() {
        if (this.tracking) {
            let angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            let currentAngle = Math.atan2(this.vy, this.vx);
            let diff = angleToPlayer - currentAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            currentAngle += diff * 0.03;
            this.vx = Math.cos(currentAngle) * this.speed;
            this.vy = Math.sin(currentAngle) * this.speed;
        }

        this.x += this.vx; this.y += this.vy;

        if (Math.random() < 0.2) {
            let trail = new Particle(this.x, this.y, this.isSpore ? "#2d4a22" : (this.tracking ? "#ff00ff" : "#33ff33"));
            trail.radius *= 0.5; particles.push(trail);
        }
        if (this.x < 0 || this.x > GAME_WIDTH || this.y < 0 || this.y > GAME_HEIGHT) {
            this.markedForDeletion = true;
            if (this.isSpore) poisonClouds.push(new PoisonGas(this.x, this.y));
        }
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = this.tracking ? "#ff00ff" : "#33ff33";
        ctx.fillStyle = this.isSpore ? "#2d4a22" : "#aaffaa"; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        if(!this.isSpore) {
            ctx.fillStyle = this.tracking ? "#ff00ff" : "#00cc00"; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

class ItemDrop {
    constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.radius = 9; this.timer = 0; }
    update() { this.timer += 0.08; }
    draw() { ctx.save(); ctx.font = "16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(this.type === 'heart' ? "❤️" : "🧲", this.x, this.y + Math.sin(this.timer) * 4); ctx.restore(); }
}

class XpOrb {
    constructor(x, y, value) { this.x = x; this.y = y; this.value = value; this.radius = 4; }
    update() {
        let dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy);
        let pullRadius = player.magnetActive ? 999 : player.magnetRange;
        if (d < pullRadius) { this.x += (dx / d) * 9.5; this.y += (dy / d) * 9.5; }
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = "#00ffcc";
        ctx.fillStyle = "#00ffcc";
        let pulse = Math.sin(Date.now() * 0.005) * 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color; this.radius = Math.random() * 3 + 1;
        let a = Math.random() * Math.PI * 2, s = Math.random() * 4 + 1;
        this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s; this.alpha = 1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.alpha -= 0.025; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
        ctx.restore();
    }
}

// ==========================================
// ENEMY STATS & AI
// ==========================================
const ENEMY_PROFILES = {
    walker:  { speed: 0.9, hp: 40,  radius: 12, xp: 10,  isBoss: false, shootChance: 0 },
    crawler: { speed: 1.5, hp: 25,  radius: 9,  xp: 12,  isBoss: false, shootChance: 0 },
    runner:  { speed: 2.1, hp: 35,  radius: 11, xp: 15,  isBoss: false, shootChance: 0.005 },
    brute:   { speed: 0.6, hp: 160, radius: 18, xp: 35,  isBoss: false, shootChance: 0 },
    mutant:  { speed: 1.2, hp: 110, radius: 14, xp: 40,  isBoss: false, shootChance: 0.01 },

    boss_town:   { speed: 0.7, hp: 800,  radius: 28, xp: 150, isBoss: true, name: "Goliath Zombie" },
    boss_forest: { speed: 1.1, hp: 1600, radius: 26, xp: 300, isBoss: true, name: "Spore Abomination" },
    boss_base:   { speed: 0.8, hp: 5500, radius: 30, xp: 500, isBoss: true, name: "Cyborg Juggernaut" },
    boss_lab:    { speed: 1.0, hp: 8500, radius: 34, xp: 800, isBoss: true, name: "Lab Experiment" },

    omega_boss:  { speed: 1.3, hp: 15000, radius: 45, xp: 3000, isBoss: true, isMajor: true, name: "PROJECT: OMEGA MUTANT" },
    final_boss_p1: { speed: 1.0, hp: 30000, radius: 50, xp: 0, isBoss: true, isMajor: true, name: "THE ARCHITECT - PHASE 1" },
    final_boss_p2: { speed: 1.5, hp: 50000, radius: 55, xp: 5000, isBoss: true, isMajor: true, name: "THE ARCHITECT - TRUE FORM" }
};

class Enemy {
    constructor(type, x, y) {
        let p = ENEMY_PROFILES[type]; this.type = type; this.x = x; this.y = y;
        this.radius = p.radius; this.speed = p.speed; this.hp = p.hp; this.maxHp = p.hp;
        this.xpValue = p.xp; this.isBoss = p.isBoss; this.isMajor = p.isMajor; this.name = p.name || "Zombie";
        this.shootChance = p.shootChance; this.bossAttackTimer = 0;
        if (!this.isBoss) { this.hp += (currentWave * 5); this.maxHp = this.hp; }

        this.abilityTimer2 = 0;
    }

    update(dt) {
        let dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy);

        if (d > 0) { this.x += (dx / d) * this.speed; this.y += (dy / d) * this.speed; }
        if (d < this.radius + player.radius) player.takeDamage();

        if (!this.isBoss && this.shootChance > 0 && Math.random() < this.shootChance) {
            enemyProjectiles.push(new EnemyProjectile(this.x, this.y, Math.atan2(dy, dx), 4.2));
        }

        if (this.isBoss) {
            this.bossAttackTimer += dt;
            let cooldown = this.isMajor ? 1000 : (this.type === "boss_town" ? 2200 : this.type === "boss_forest" ? 2500 : 1600);

            if (this.type === "final_boss_p2") {
                this.abilityTimer2 += dt;
                if (this.bossAttackTimer >= 1000) {
                    this.bossAttackTimer = 0;
                    for (let i = 0; i < 20; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, (Math.PI*2/20)*i, 6.0));
                }
                if (this.abilityTimer2 >= 4000) {
                    this.abilityTimer2 = 0;
                    enemyProjectiles.push(new EnemyProjectile(this.x, this.y, Math.atan2(dy, dx), 3.0, false, true));
                    this.x = player.x + (Math.random() > 0.5 ? 200 : -200);
                    this.y = player.y + (Math.random() > 0.5 ? 200 : -200);
                    enemies.push(new Enemy("mutant", this.x + 30, this.y));
                    enemies.push(new Enemy("brute", this.x - 30, this.y));
                }
            }
            else if (this.type === "final_boss_p1") {
                if (this.bossAttackTimer >= 1500) {
                    this.bossAttackTimer = 0;
                    let baseAngle = Math.atan2(dy, dx);
                    for (let i = 0; i < 8; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, baseAngle + (Math.PI*2/8)*i, 5.0));
                    if (Math.random() < 0.5) enemies.push(new Enemy("runner", this.x + 40, this.y));
                }
            }
            else if (this.type === "omega_boss") {
                if (this.bossAttackTimer >= 1100) {
                    this.bossAttackTimer = 0;
                    for (let i = 0; i < 16; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, (Math.PI*2/16)*i, 5.0));
                    if (Math.random() < 0.4) enemies.push(new Enemy("mutant", this.x + 30, this.y));
                }
            }
            else if (this.bossAttackTimer >= cooldown) {
                this.bossAttackTimer = 0;
                let baseAngle = Math.atan2(dy, dx);

                if (this.type === "boss_town") {
                    this.x += Math.cos(baseAngle) * 60;
                    this.y += Math.sin(baseAngle) * 60;
                    for (let i = 0; i < 4; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, baseAngle + (Math.PI/2)*i, 3.8));
                } else if (this.type === "boss_forest") {
                    for (let i = 0; i < 10; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, Math.random() * Math.PI * 2, 2.0, true));
                } else if (this.type === "boss_base") {
                    for (let i = -1; i <= 1; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, baseAngle + i*0.1, 7.5));
                } else {
                    for (let i = -2; i <= 2; i++) enemyProjectiles.push(new EnemyProjectile(this.x, this.y, baseAngle + i*0.22, 6.5));
                }
            }
        }
    }

    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        let angle = Math.atan2(player.y - this.y, player.x - this.x);
        ctx.rotate(angle);

        if (this.type === "final_boss_p2") {
            ctx.shadowBlur = 25; ctx.shadowColor = "#ff0000";
            ctx.fillStyle = "#000000";
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 5; ctx.stroke();
            ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        } else if (this.isMajor) {
            ctx.shadowBlur = 20; ctx.shadowColor = "#ffea00";
            ctx.fillStyle = "#110000";
            ctx.beginPath(); ctx.moveTo(-25, -20); ctx.lineTo(25, -20); ctx.lineTo(30, 0); ctx.lineTo(25, 20); ctx.lineTo(-25, 20); ctx.fill();
            ctx.strokeStyle = "#ffea00"; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(10, -8, 4, 0, Math.PI*2); ctx.arc(10, 8, 4, 0, Math.PI*2); ctx.fill();
        } else if (this.isBoss) {
            if (this.type === "boss_town") {
                ctx.fillStyle = "#4a3b2c"; ctx.fillRect(-20, -20, 40, 40);
                ctx.fillStyle = "#ff3333"; ctx.fillRect(10, -8, 8, 16);
            } else if (this.type === "boss_forest") {
                ctx.fillStyle = "#2d4a22";
                ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#88ff33";
                for(let i=0; i<6; i++) {
                    ctx.beginPath(); ctx.arc(18 * Math.cos(i*1.1), 18 * Math.sin(i*1.1), 6, 0, Math.PI*2); ctx.fill();
                }
            } else if (this.type === "boss_base") {
                ctx.fillStyle = "#556677";
                ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(7, 15); ctx.lineTo(-15, 15); ctx.lineTo(-20, 0); ctx.lineTo(-15, -15); ctx.lineTo(7, -15); ctx.fill();
                ctx.fillStyle = "#00ffff"; ctx.fillRect(5, -4, 12, 8);
            } else {
                ctx.fillStyle = "#441155";
                ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#ff00ff"; ctx.beginPath(); ctx.arc(10, 0, 8, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.fillStyle = "#4c7a34"; ctx.fillRect(5, -this.radius/1.5, 12, 4); ctx.fillRect(5, this.radius/1.5 - 4, 12, 4);
            ctx.fillStyle = "#5c4e3a";
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ff0000";
            ctx.beginPath(); ctx.arc(this.radius/2, -3, 2, 0, Math.PI * 2); ctx.arc(this.radius/2, 3, 2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();

        if (this.isBoss && !this.isMajor && this.hp > 0) {
            let w = 60, h = 6;
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(this.x - w/2, this.y - this.radius - 18, w, h);
            ctx.fillStyle = "#ff2222"; ctx.fillRect(this.x - w/2, this.y - this.radius - 18, w * (this.hp / this.maxHp), h);
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        createBloodSplatter(this.x, this.y, this.isBoss ? "#00ff44" : "#aa2222", 6);
        if (this.hp <= 0) {
            if (playerWeapon.vampireLvl > 0 && player.hp < player.maxHp && Math.random() < 0.05) player.hp++;
            return true;
        }
        return false;
    }
}

// ==========================================
// GAME LOOPS & RENDERING
// ==========================================
let lastTime = 0;
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    let dt = timestamp - lastTime; lastTime = timestamp;

    if (screenShake > 0) { screenShake *= 0.9; if (screenShake < 0.5) screenShake = 0; }

    if (gameState === STATE.PLAYING) {
        updateGame(dt);
        renderGame();
    } else if (gameState === STATE.CUTSCENE) {
        updateCutscene(dt); renderGame(); drawCutscene();
    } else if (gameState === STATE.START) {
        renderStartScreen();
    } else if (gameState === STATE.GAMEOVER || gameState === STATE.VICTORY) {
        renderGame();
    }
    requestAnimationFrame(gameLoop);
}

// ==========================================
// PASSIVE ABILITIES IMPLEMENTED HERE
// ==========================================
const CHARACTERS = [
    { name: "SURVIVOR", desc: "Balanced stats.", passive: "Skill: +15% XP Gain", hp: 3, speed: 3.5, dmgMod: 1.0, color: "#ffffff", init: () => { player.xpMultiplier += 0.15; } },
    { name: "SPRINTER", desc: "Fast, Low HP.", passive: "Skill: +15% Fire Rate", hp: 2, speed: 4.5, dmgMod: 0.8, color: "#00ffff", init: () => { playerWeapon.fireRate *= 0.85; } },
    { name: "TANK", desc: "Slow, High HP.", passive: "Skill: Auto HP Regen", hp: 5, speed: 2.5, dmgMod: 1.0, color: "#ff3333", init: () => { playerWeapon.regenLvl = 1; } },
    { name: "HEAVY", desc: "Avg HP, High Dmg.", passive: "Skill: Pierce +1", hp: 3, speed: 3.0, dmgMod: 1.5, color: "#ffcc00", init: () => { playerWeapon.pierce += 1; } }
];

function renderStartScreen() {
    ctx.fillStyle = "#111116"; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = "#00ffcc"; ctx.font = "bold 42px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("APOCALYPSE SURVIVOR", GAME_WIDTH / 2, 80);
    ctx.fillStyle = "#ffffff"; ctx.font = "20px Arial";
    ctx.fillText("CHOOSE YOUR OPERATIVE", GAME_WIDTH / 2, 130);

    let boxW = 160, boxH = 240, gap = 25;
    let startX = (GAME_WIDTH - (boxW * 4 + gap * 3)) / 2;

    CHARACTERS.forEach((char, i) => {
        let bx = startX + i * (boxW + gap);
        let by = 180;

        if (mouse.x > bx && mouse.x < bx + boxW && mouse.y > by && mouse.y < by + boxH) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeStyle = char.color; ctx.lineWidth = 4;
            canvas.style.cursor = "pointer";
        } else {
            ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
        }

        ctx.strokeRect(bx, by, boxW, boxH);

        ctx.fillStyle = char.color; ctx.font = "bold 18px monospace";
        ctx.fillText(char.name, bx + boxW/2, by + 35);

        ctx.fillStyle = "#ddd"; ctx.font = "12px Arial";
        ctx.fillText(char.desc, bx + boxW/2, by + 65);

        ctx.fillStyle = "#00ffcc"; ctx.font = "bold 11px Arial";
        ctx.fillText(char.passive, bx + boxW/2, by + 95);

        ctx.fillStyle = "#ddd"; ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`Health: ${char.hp} HP`, bx + 15, by + 135);
        ctx.fillText(`Speed:  ${char.speed}`, bx + 15, by + 165);
        ctx.fillText(`Damage: x${char.dmgMod}`, bx + 15, by + 195);
        ctx.textAlign = "center";
    });

    ctx.fillStyle = "#888888"; ctx.font = "14px monospace";
    ctx.fillText("Controls: WASD/Arrows = Move | Mouse = Aim & Shoot | Space = Dash", GAME_WIDTH / 2, GAME_HEIGHT - 40);
}

function selectCharacter(index) {
    chosenCharacter = CHARACTERS[index];
    player.maxHp = chosenCharacter.hp;
    player.hp = chosenCharacter.hp;
    player.speed = chosenCharacter.speed;
    playerWeapon.damage *= chosenCharacter.dmgMod;

    // Apply their passive ability
    if (chosenCharacter.init) chosenCharacter.init();

    gameState = STATE.PLAYING;
    generateSolidBuildings();
    canvas.style.cursor = "crosshair";
}

function updateGame(dt) {
    player.update(dt);
    if (keys['mousedown']) fireActiveWeapon();
    handleSpawning(dt);

    let isAnyBossWave = (currentWave % 5 === 0);
    if (!isAnyBossWave) {
        waveTimer += dt;
        if (waveTimer >= 30000) advanceWave();
    } else if (bossSpawned && enemies.filter(e => e.isBoss).length === 0) {
        advanceWave();
    }

    for (let i = poisonClouds.length - 1; i >= 0; i--) {
        poisonClouds[i].update(dt);
        if (poisonClouds[i].timer >= poisonClouds[i].life) poisonClouds.splice(i, 1);
    }

    for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].update(); if (bullets[i].markedForDeletion) bullets.splice(i, 1); }

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        let ep = enemyProjectiles[i]; ep.update();
        if (Math.hypot(player.x - ep.x, player.y - ep.y) < player.radius + ep.radius) {
            player.takeDamage(); ep.markedForDeletion = true;
            if (ep.isSpore) poisonClouds.push(new PoisonGas(ep.x, ep.y));
        }

        if (ep.isSpore) {
            for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
                let b = bullets[bIdx];
                if (Math.hypot(b.x - ep.x, b.y - ep.y) < b.radius + ep.radius) {
                    ep.hp -= b.damage;
                    b.pierce--; if (b.pierce <= 0) bullets.splice(bIdx, 1);
                    if (ep.hp <= 0) {
                        ep.markedForDeletion = true;
                        poisonClouds.push(new PoisonGas(ep.x, ep.y));
                        createBloodSplatter(ep.x, ep.y, "#33ff33", 5);
                        break;
                    }
                }
            }
        }

        if (ep.markedForDeletion) enemyProjectiles.splice(i, 1);
    }

    for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
        let e = enemies[eIdx]; e.update(dt);
        for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
            let b = bullets[bIdx];
            if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
                let dead = e.takeDamage(b.damage);
                if (b.isCrit && Math.random() < 0.4) createBloodSplatter(e.x, e.y, "#ffea00", 8);
                b.pierce--; if (b.pierce <= 0) bullets.splice(bIdx, 1);
                if (dead) {
                    kills++;
                    createBloodSplatter(e.x, e.y, e.isBoss ? "#00ff33" : "#ff1111", 18);

                    // NEW: Ensure drops are outside of buildings
                    let dropPos = getValidDropLocation(e.x, e.y);

                    xpOrbs.push(new XpOrb(dropPos.x, dropPos.y, e.xpValue));
                    let roll = Math.random();
                    if (roll < 0.045) items.push(new ItemDrop(dropPos.x, dropPos.y, 'heart'));
                    else if (roll < 0.06) items.push(new ItemDrop(dropPos.x, dropPos.y, 'magnet'));

                    if (e.type === "final_boss_p1") {
                        startCutscene("WARNING: BIO-CORE RUPTURED.\nINITIATING PROTOCOL: OMEGA TRUE FORM.", "SYSTEM AI", () => {
                            enemies.push(new Enemy("final_boss_p2", GAME_WIDTH/2, 100));
                            bossSpawned = true;
                            screenShake = 30;
                        });
                    } else if (e.type === "final_boss_p2") {
                        triggerVictory();
                    }

                    enemies.splice(eIdx, 1);
                    break;
                }
            }
        }
    }

    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i]; item.update();
        if (Math.hypot(player.x - item.x, player.y - item.y) < player.radius + item.radius) {
            if (item.type === 'heart') player.hp = Math.min(player.maxHp, player.hp + 1);
            else if (item.type === 'magnet') { player.magnetActive = true; setTimeout(() => { player.magnetActive = false; }, 4000); }
            items.splice(i, 1);
        }
    }

    for (let i = xpOrbs.length - 1; i >= 0; i--) {
        let orb = xpOrbs[i]; orb.update();
        if (Math.hypot(player.x - orb.x, player.y - orb.y) < player.radius + orb.radius) { player.gainXP(orb.value); xpOrbs.splice(i, 1); }
    }
    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); if (particles[i].alpha <= 0) particles.splice(i, 1); }
    for (let i = dashGhosts.length - 1; i >= 0; i--) { dashGhosts[i].alpha -= 0.08; if (dashGhosts[i].alpha <= 0) dashGhosts.splice(i, 1); }
}

function renderGame() {
    ctx.save();
    if (screenShake > 0) { ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake); }

    let stage = STAGES[currentStageIndex];
    ctx.fillStyle = stage.bgColor; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawGridBackground();
    drawBuildings();

    poisonClouds.forEach(p => p.draw());
    xpOrbs.forEach(o => o.draw()); items.forEach(item => item.draw());
    bullets.forEach(b => b.draw()); enemyProjectiles.forEach(ep => ep.draw());
    enemies.forEach(e => e.draw()); particles.forEach(p => p.draw());

    dashGhosts.forEach(g => {
        ctx.save(); ctx.globalAlpha = g.alpha; ctx.shadowBlur = 15; ctx.shadowColor = chosenCharacter?.color || "#ffffff";
        ctx.fillStyle = chosenCharacter?.color || "#ffffff";
        ctx.beginPath(); ctx.arc(g.x, g.y, player.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });

    player.draw();
    ctx.restore();

    drawCanvasHUD();
    drawSkillIconsUI();
    drawMajorBossBarHUD();
}

function drawMajorBossBarHUD() {
    let majorBoss = enemies.find(e => e.isMajor);
    if (majorBoss) {
        ctx.save();
        let bw = 600, bh = 25, bx = (GAME_WIDTH - bw) / 2, by = 40;
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(bx, by, bw, bh);
        let ratio = Math.max(0, majorBoss.hp / majorBoss.maxHp);
        ctx.fillStyle = majorBoss.type === "final_boss_p2" ? "#ff0000" : "#ff1111";
        ctx.fillRect(bx, by, bw * ratio, bh);
        ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(majorBoss.name, GAME_WIDTH/2, by + bh/2);
        ctx.restore();
    }
}

function drawCanvasHUD() {
    let stage = STAGES[currentStageIndex];
    ctx.save();
    ctx.font = "bold 18px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    for (let i = 0; i < player.maxHp; i++) ctx.fillText(i < player.hp ? "❤️" : "🖤", 15 + (i * 26), 15);

    ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px monospace"; ctx.textAlign = "right";
    ctx.fillText(`KILLS: ${kills}`, GAME_WIDTH - 15, 15);

    ctx.textAlign = "center"; ctx.fillStyle = "#ffcc00";
    ctx.fillText(`STAGE ${currentStageIndex + 1}: ${stage.name.toUpperCase()} - WAVE ${currentWave}`, GAME_WIDTH / 2, 15);

    let barW = 500, barH = 12, barX = (GAME_WIDTH - barW) / 2, barY = GAME_HEIGHT - 20;
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; ctx.fillRect(barX, barY, barW, barH);
    let progressRatio = Math.min(1, player.xp / player.xpNeeded);
    ctx.fillStyle = "#00ffcc"; ctx.fillRect(barX, barY, barW * progressRatio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5; ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(`LVL ${player.level}`, barX - 12, barY + barH/2);
    ctx.restore();
}

function fireActiveWeapon() {
    let now = Date.now();
    if (now - player.lastShotTime >= playerWeapon.fireRate) {
        player.lastShotTime = now;
        let baseAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        let count = playerWeapon.projectiles;
        createBloodSplatter(player.x, player.y, chosenCharacter?.color || "#ffffff", 5);
        for (let i = 0; i < count; i++) {
            let offset = count > 1 ? ((i / (count - 1)) - 0.5) * (playerWeapon.spread * 1.5) : 0;
            bullets.push(new Bullet(player.x, player.y, baseAngle + offset));
        }
    }
}

function handleSpawning(dt) {
    let stage = STAGES[currentStageIndex];
    let isAnyBossWave = (currentWave % 5 === 0);

    if (isAnyBossWave) {
        if (!bossSpawned) {
            let bType;
            if (currentWave === 50) bType = "final_boss_p1";
            else if (currentWave === 25) bType = "omega_boss";
            else bType = currentWave % 20 === 5 ? "boss_town" : currentWave % 20 === 10 ? "boss_forest" : currentWave % 20 === 15 ? "boss_base" : "boss_lab";

            if (currentWave === 50 && !bossSpawned) {
                startCutscene("THE FINAL THRESHOLD REACHED.\nPREPARE FOR TERMINATION.", "SYSTEM AI", () => {
                    enemies.push(new Enemy(bType, GAME_WIDTH/2, -50));
                    bossSpawned = true; screenShake = 20;
                });
            } else if (currentWave === 25 && !bossSpawned) {
                startCutscene("WARNING: MASSIVE BIOMETRIC SPIKE DETECTED.\nSUBJECT 'OMEGA' HAS BREACHED SECTOR 7.", "SYSTEM AI", () => {
                    enemies.push(new Enemy(bType, GAME_WIDTH/2, -50));
                    bossSpawned = true; screenShake = 40;
                });
            } else {
                enemies.push(new Enemy(bType, GAME_WIDTH/2, -30));
                bossSpawned = true; screenShake = 15;
            }
        }
        return;
    }

    spawnTimer += dt;
    let rate = Math.max(900, 2200 - (currentWave * 70));
    if (spawnTimer >= rate) {
        spawnTimer = 0;
        let pool = stage.enemyTypes, type = pool[Math.floor(Math.random() * pool.length)];
        let rx = Math.random() < 0.5 ? 20 : GAME_WIDTH - 20;
        let ry = Math.random() * GAME_HEIGHT;
        enemies.push(new Enemy(type, rx, ry));
    }
}

function advanceWave() {
    currentWave++; waveTimer = 0; bossSpawned = false;
    let idx = STAGES.findIndex(s => currentWave >= s.startWave && currentWave <= s.endWave);
    if (idx !== -1 && idx !== currentStageIndex) { currentStageIndex = idx; generateSolidBuildings(); }
}

function createBloodSplatter(x, y, color, count) { for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color)); }

function drawSkillIconsUI() {
    ctx.save();
    let startX = 15, startY = GAME_HEIGHT - 45, iconSize = 25, gap = 6;
    let activeSkills = [];
    if (playerWeapon.damageLvl > 1) activeSkills.push({ name: `DMG ${playerWeapon.damageLvl}`, color: "#ff3333" });
    if (playerWeapon.fireRateLvl > 1) activeSkills.push({ name: `SPD ${playerWeapon.fireRateLvl}`, color: "#ffcc00" });
    if (playerWeapon.multishotLvl > 1) activeSkills.push({ name: `MUL ${playerWeapon.multishotLvl}`, color: "#33ccff" });
    if (playerWeapon.bounceLvl > 0) activeSkills.push({ name: `RIC ${playerWeapon.bounceLvl}`, color: "#ff00ff" });
    if (playerWeapon.auraLvl > 0) activeSkills.push({ name: `AUR ${playerWeapon.auraLvl}`, color: "#00ffff" });
    if (playerWeapon.vampireLvl > 0) activeSkills.push({ name: `VAM ${playerWeapon.vampireLvl}`, color: "#ff3399" });
    if (playerWeapon.pierceLvl > 1) activeSkills.push({ name: `PRC ${playerWeapon.pierceLvl}`, color: "#7ae05e" });
    if (playerWeapon.maxHpLvl > 1) activeSkills.push({ name: `HP ${playerWeapon.maxHpLvl}`, color: "#ff5252" });
    if (playerWeapon.speedLvl > 1) activeSkills.push({ name: `AGI ${playerWeapon.speedLvl}`, color: "#ffea00" });
    if (playerWeapon.magnetLvl > 1) activeSkills.push({ name: `MAG ${playerWeapon.magnetLvl}`, color: "#e050ff" });
    if (playerWeapon.regenLvl > 0) activeSkills.push({ name: `REG ${playerWeapon.regenLvl}`, color: "#00ffcc" });
    if (playerWeapon.bSpeedLvl > 1) activeSkills.push({ name: `VEL ${playerWeapon.bSpeedLvl}`, color: "#fff" });
    if (playerWeapon.spreadLvl > 1) activeSkills.push({ name: `STB ${playerWeapon.spreadLvl}`, color: "#99ff99" });
    if (playerWeapon.critLvl > 0) activeSkills.push({ name: `CRT ${playerWeapon.critLvl}`, color: "#ff3300" });
    if (playerWeapon.iFrameLvl > 1) activeSkills.push({ name: `BNK ${playerWeapon.iFrameLvl}`, color: "#bcbcbc" });
    if (playerWeapon.xpGainLvl > 1) activeSkills.push({ name: `BNT ${playerWeapon.xpGainLvl}`, color: "#aa88ff" });

    activeSkills.forEach((skill, index) => {
        let posX = startX + (index * (iconSize + gap));
        if (posX > GAME_WIDTH - 40) return;
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(posX, startY, iconSize, iconSize);
        ctx.strokeStyle = skill.color; ctx.lineWidth = 1; ctx.strokeRect(posX, startY, iconSize, iconSize);
        ctx.fillStyle = "#fff"; ctx.font = "7px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(skill.name, posX + iconSize/2, startY + iconSize/2);
    });
    ctx.restore();
}

function endGame() {
    gameState = STATE.GAMEOVER;
    document.getElementById("game-over-screen").classList.remove("hidden");
    document.getElementById("final-stats").innerText = `You reached Stage ${currentStageIndex + 1}, Wave ${currentWave}`;
}

function triggerVictory() {
    gameState = STATE.VICTORY;
    document.getElementById("victory-screen").classList.remove("hidden");
}

function triggerLevelUp() {
    gameState = STATE.LEVEL_UP;
    document.getElementById("level-up-screen").classList.remove("hidden");

    const POOLS = {
        COMMON: [
            { title: "Adrenaline", desc: "+15% Movement Speed", action: () => { player.speed += 0.45; playerWeapon.speedLvl++; } },
            { title: "Velocity", desc: "+25% Bullet Speed", action: () => { playerWeapon.bulletSpeed += 2; playerWeapon.bSpeedLvl++; } },
            { title: "Magnetism", desc: "+35px XP Range", action: () => { player.magnetRange += 35; playerWeapon.magnetLvl++; } },
            { title: "Laser Sight", desc: "Tightens Gun Spread", action: () => { playerWeapon.spread *= 0.7; playerWeapon.spreadLvl++; } },
            { title: "Bounty", desc: "+15% Experience Gained", action: () => { player.xpMultiplier += 0.15; playerWeapon.xpGainLvl++; } }
        ],
        RARE: [
            { title: "Heavy Rounds", desc: "+20 Bullet Damage", action: () => { playerWeapon.damage += 20; playerWeapon.damageLvl++; } },
            { title: "Hyper Trigger", desc: "Fires 25% Faster", action: () => { playerWeapon.fireRate *= 0.75; playerWeapon.fireRateLvl++; } },
            { title: "Shatter Shot", desc: "Bullets Pierce 1 Enemy", action: () => { playerWeapon.pierce += 1; playerWeapon.pierceLvl++; } },
            { title: "Titanium Plating", desc: "+1 Max Heart", action: () => { player.maxHp += 1; player.hp += 1; playerWeapon.maxHpLvl++; } }
        ],
        EPIC: [
            { title: "Multishot", desc: "Fires An Extra Projectile", action: () => { playerWeapon.projectiles += 1; playerWeapon.multishotLvl++; } },
            { title: "Overcharge", desc: "+10% Crit Chance", action: () => { player.critChance += 0.10; playerWeapon.critLvl++; } },
            { title: "Plasma Aura", desc: "Spinning Energy Shield", action: () => { playerWeapon.auraLvl++; } },
            { title: "Ricochet", desc: "Bullets Bounce Off Walls (1 Time)", action: () => { playerWeapon.bounceCount += 1; playerWeapon.bounceLvl++; } }
        ],
        LEGENDARY: [
            { title: "Vampirism", desc: "5% Chance To Heal On Kill", action: () => { playerWeapon.vampireLvl++; } },
            { title: "Ethereal Dash", desc: "Grants Invincibility While Dashing", action: () => { dashSkill.invincibleLvl++; } },
            { title: "Ethereal Regen", desc: "Heal 1 HP Every 8s Out Of Combat", action: () => { playerWeapon.regenLvl++; } }
        ]
    };

    let rarityColors = { COMMON: { text: "#ffffff", bg: "rgba(200, 200, 200, 0.2)" }, RARE: { text: "#3399ff", bg: "rgba(51, 153, 255, 0.2)" }, EPIC: { text: "#b333ff", bg: "rgba(179, 51, 255, 0.2)" }, LEGENDARY: { text: "#ffcc00", bg: "rgba(255, 204, 0, 0.2)" } };

    let options = [];
    for (let i = 0; i < 3; i++) {
        let candidate, poolName, isDuplicate = true;
        while (isDuplicate) {
            let rarityRoll = Math.random();
            // EXACT USER MATH: Common 35%, Rare 30%, Epic 25%, Legendary 10%
            poolName = rarityRoll < 0.35 ? "COMMON" : rarityRoll < 0.65 ? "RARE" : rarityRoll < 0.90 ? "EPIC" : "LEGENDARY";
            let pool = POOLS[poolName];
            candidate = pool[Math.floor(Math.random() * pool.length)];
            if (!options.some(opt => opt.data.title === candidate.title)) isDuplicate = false;
        }
        options.push({ data: candidate, rarity: poolName });
    }

    for (let i = 0; i < 3; i++) {
        let optNum = i + 1;
        let titleEl = document.getElementById(`option${optNum}-title`);
        let descEl = document.getElementById(`option${optNum}-desc`);
        let cardEl = document.getElementById(`option${optNum}`);

        let cardData = options[i].data; let poolName = options[i].rarity;
        titleEl.innerText = cardData.title; descEl.innerText = cardData.desc;

        cardEl.style.backgroundColor = rarityColors[poolName].bg;
        cardEl.style.borderColor = rarityColors[poolName].text;
        cardEl.style.borderWidth = "3px";
        titleEl.style.color = rarityColors[poolName].text;

        let rarityLabel = document.createElement("div");
        rarityLabel.className = "rarity-badge";
        rarityLabel.style.fontSize = "12px"; rarityLabel.style.fontWeight = "bold";
        rarityLabel.style.color = rarityColors[poolName].text; rarityLabel.style.marginBottom = "8px";
        rarityLabel.innerText = poolName;

        let oldLabel = titleEl.previousElementSibling;
        if (oldLabel && oldLabel.className === "rarity-badge") oldLabel.remove();
        titleEl.parentElement.insertBefore(rarityLabel, titleEl);

        cardEl.onclick = () => { cardData.action(); closeLevelUpScreen(); };
    }
}

function closeLevelUpScreen() { gameState = STATE.PLAYING; document.getElementById("level-up-screen").classList.add("hidden"); }

// ==========================================
// EVENT LISTENERS & INPUT
// ==========================================
document.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
document.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("mousemove", (e) => {
    let rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * GAME_WIDTH;
    mouse.y = ((e.clientY - rect.top) / rect.height) * GAME_HEIGHT;
});
canvas.addEventListener("mousedown", () => { keys['mousedown'] = true; });
canvas.addEventListener("mouseup", () => { keys['mousedown'] = false; });

canvas.addEventListener("click", () => {
    if (gameState === STATE.START) {
        let boxW = 160, boxH = 240, gap = 25;
        let startX = (GAME_WIDTH - (boxW * 4 + gap * 3)) / 2;
        for (let i = 0; i < 4; i++) {
            let bx = startX + i * (boxW + gap);
            if (mouse.x > bx && mouse.x < bx + boxW && mouse.y > 180 && mouse.y < 180 + boxH) { selectCharacter(i); break; }
        }
    } else if (gameState === STATE.CUTSCENE) {
        skipOrEndCutscene();
    }
});

document.addEventListener("keypress", (e) => {
    if (e.key === " " && gameState === STATE.PLAYING) {
        e.preventDefault();
        let now = Date.now();
        if (now - dashSkill.lastUsed >= dashSkill.cooldown && !dashSkill.isActive) {
            dashSkill.isActive = true; dashSkill.timer = dashSkill.duration; dashSkill.lastUsed = now;
            let speed = player.speed * dashSkill.speedMultiplier;
            let angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
            dashSkill.vx = Math.cos(angle) * speed; dashSkill.vy = Math.sin(angle) * speed;
        }
    } else if (e.key === " " && gameState === STATE.CUTSCENE) {
        e.preventDefault(); skipOrEndCutscene();
    }
});

requestAnimationFrame(gameLoop);
