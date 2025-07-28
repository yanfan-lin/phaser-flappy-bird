// Game dimension
const GAME_WIDTH = 288;
const GAME_HEIGHT = 512;

const GRAVITY = 600;
const FLAP_SPEED = -230;      // Default speed when bird flaps
const PIPE_SPEED = -150;      // Default speed of pipes moving left
const SPAWN_INTERVAL = 1500;  // Time between pip spawns (in ms)

const Assets = {
  BACKGROUND: "background",
  BIRD_MID: "character1",
  BIRD_DOWN: "character2",
  BIRD_UP: "character3",
  BIRD_FALL: "character4",
  PIPE: "pipe",
  BASE: "base",
  GAME_OVER: "gameover",
  SCORE_PANEL: "score",
  RETRY: "retry",
  LOGO: "logo",
};

class FlappyBirdScene extends Phaser.Scene {
  constructor() {
    super("FlappyBirdScene");

    // Boolean to check if game has started
    this.gameStarted = false;   

    // Boolean to chekc if game is over
    this.gameOver = false;
    this.score = 0;

    // Default speed factor to increase or decrease difficulty
    this.speedMultiplier = 1.0; 
  }

  preload() {

    // Load required images used in the game
    this.load.image(Assets.BACKGROUND, "assets/GameObjects/background.png");
    this.load.image(Assets.BIRD_MID, "assets/GameObjects/bird-midflap.png");
    this.load.image(Assets.BIRD_DOWN, "assets/GameObjects/bird-downflap.png");
    this.load.image(Assets.BIRD_UP, "assets/GameObjects/bird-upflap.png");
    this.load.image(Assets.BIRD_FALL, "assets/GameObjects/bird-fall.png");
    this.load.image(Assets.PIPE, "assets/GameObjects/pipe.png");
    this.load.image(Assets.BASE, "assets/GameObjects/base.png");
    this.load.image(Assets.GAME_OVER, "assets/UI/gameover.png");
    this.load.image(Assets.SCORE_PANEL, "assets/UI/score.png");
    this.load.image(Assets.RETRY, "assets/UI/retry.png");
    this.load.image(Assets.LOGO, "assets/UI/logo.png");

    // Load bitmap font and font data 
    this.load.bitmapFont("flappyFont", "assets/UI/font.png", "assets/UI/font.fnt");
  }


  create() {
    // Generating background
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, Assets.BACKGROUND).setOrigin(0, 0);

    // Get size of base sprite to be generated
    const baseTexture = this.textures.get(Assets.BASE);
    const baseHeight = baseTexture.getSourceImage().height;
    const baseWidth = baseTexture.getSourceImage().width;

    // Generating base
    this.base = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT - baseHeight / 2,
      baseWidth,
      baseHeight,
      Assets.BASE
    );

    // Generating phsics body of base for collision
    this.physics.add.existing(this.base, true);
    this.base.setDepth(1);

    // Generating bird
    this.bird = this.physics.add.sprite(GAME_WIDTH / 4, GAME_HEIGHT / 2, Assets.BIRD_MID);

    // Bird stays on the screen
    this.bird.setCollideWorldBounds(true);
    this.bird.body.allowGravity = false;
    this.bird.setDepth(1);

    // Bird flapping animation
    this.anims.create({
      key: "fly",
      frames: [
        { key: Assets.BIRD_MID },
        { key: Assets.BIRD_DOWN },
        { key: Assets.BIRD_UP }
      ],
      frameRate: 9,
      repeat: -1
    });

    // Bird fall animation
    this.anims.create({
      key: "fall",
      frames: [{ key: Assets.BIRD_FALL }],
      frameRate: 9,
      repeat: -1
    });

    this.bird.anims.play("fly", true);

    // UI related to speed option 
    this.speedUI = [];

    // Logo
    this.logo = this.add.image(GAME_WIDTH / 2, 80, Assets.LOGO).setOrigin(0.5).setScale(0.6).setDepth(1);
    this.speedUI.push(this.logo);

    // Title text
    const title = this.add.bitmapText(GAME_WIDTH / 2, 140, "flappyFont", "Select Speed:", 24)
      .setOrigin(0.5).setDepth(1);
    this.speedUI.push(title);

    // Speed options
    const speeds = [
      { label: "70 (Easy)", value: 0.7 },
      { label: "100 (Normal)", value: 1.0 },
      { label: "150 (Hard)", value: 1.5 }
    ];

    // Create clickable buttons for speed options
    speeds.forEach((speed, i) => {
      const y = 190 + i * 50;
      const speedText = this.add.bitmapText(GAME_WIDTH / 2, y, "flappyFont", speed.label, 20)
        .setOrigin(0.5)
        .setDepth(1)
        .setInteractive({ useHandCursor: true });

      speedText.on("pointerdown", () => {
        this.speedMultiplier = speed.value; // Set the user-chosen speed 
        this.cleanupSpeedUI();              // Remove UI after game starts
        this.startGame();
      });

      this.speedUI.push(speedText);
    });
  }

  // Remove speed option UI
  cleanupSpeedUI() {
    this.speedUI.forEach(item => item.destroy());
    this.speedUI = [];
  }

  startGame() {
    this.gameStarted = true;
    this.bird.body.allowGravity = true;

    this.upperPipes = this.physics.add.group();
    this.lowerPipes = this.physics.add.group();
    this.spawnTime = 0;

    this.spawnPipes();
    
    // Collision Detection between bird and base/pipes
    this.physics.add.collider(this.bird, this.upperPipes, this.handleCollision, null, this);
    this.physics.add.collider(this.bird, this.lowerPipes, this.handleCollision, null, this);
    this.physics.add.collider(this.bird, this.base, this.handleBaseHit, null, this);

    // Display score text
    this.scoreText = this.add.text(GAME_WIDTH / 2, 30, "0", {
      fontSize: "32px",
      fontFamily: "Fantasy",
      fill: "white"
    }).setOrigin(0.5).setDepth(1);

    // Set the the flap speed when user clicks screen
    this.input.on("pointerdown", () => {
      if (!this.gameOver) this.bird.setVelocityY(FLAP_SPEED);
    });
  }

  update(time) {
    if (!this.gameOver) {

      // Scrolling speed decided by speed factor
      this.base.tilePositionX += 1 * this.speedMultiplier;
    }

    if (!this.gameStarted) return;

    let scoreIncremented = false;

    // Increment score when bird passed pipes 
    [this.upperPipes, this.lowerPipes].forEach((group) => {
      group.children.iterate((pipe) => {
        if (!pipe) return;

        if (!pipe.hasPassed && pipe.x + pipe.width < this.bird.x) {
          pipe.hasPassed = true;
          if (!scoreIncremented) {
            this.score++;
            this.scoreText.setText(this.score);
            scoreIncremented = true;
          }
        }
        
        // Remove pies when the move off screen
        if (pipe.x + pipe.width < 0) {
          pipe.destroy()
        }
      });
    });


    // Spawn new pipes
    if (this.spawnTime < time && !this.gameOver) {
      this.spawnPipes();
    }
  }

  spawnPipes() {
    const baseHeight = this.textures.get(Assets.BASE).getSourceImage().height;

    const pipeHeight = 320;

    // The gap between upper and lower pipes
    const gapHeight = (1 / 3) * (GAME_HEIGHT - baseHeight);

    // Generate Random offset to change pip height
    const offset = ((Math.random() * pipeHeight) / 2) * (Math.floor(Math.random() * 3) - 1);

    // Calculate the position for the lower pipe
    const lowerY = 2 * gapHeight + pipeHeight / 2 + offset;

    // Calculate the position for the upper pipe
    const upperY = gapHeight - pipeHeight / 2 + offset;

    // Create the upper pipe at top right 
    const upperPipe = this.upperPipes.create(GAME_WIDTH, upperY, Assets.PIPE);

    // Create the lower pip at buttom right
    const lowerPipe = this.lowerPipes.create(GAME_WIDTH, lowerY, Assets.PIPE);

    upperPipe.setAngle(180);
    upperPipe.body.allowGravity = false;
    lowerPipe.body.allowGravity = false;

    // Set the speed of pipes moving from right to left based on user's choice
    upperPipe.setVelocityX(PIPE_SPEED * this.speedMultiplier);
    lowerPipe.setVelocityX(PIPE_SPEED * this.speedMultiplier);

    this.spawnTime = this.time.now + SPAWN_INTERVAL;
  }

  // Handle when bird hits the pipes
  handleCollision(bird, pipe) {
    if (this.gameOver) return;

    bird.anims.play("fall", true);
    bird.setVelocityX(0);
    pipe.body.enable = false;

    // Array that holds both upper and lower pipe groups
    const pipeGroups = [this.upperPipes, this.lowerPipes];

    for (let i = 0; i < pipeGroups.length; i++) {
      const group = pipeGroups[i];
      group.children.iterate((pipe) => {
        // Stop the pipe from moving 
        pipe.body.velocity.x = 0;
      });
    }

    this.gameOver = true;
  }

  // Handle when bird hits the base
  handleBaseHit() {
    this.bird.anims.play("fall", true);   
    this.bird.setVelocity(0, 0);          // Stop bird movement
    this.bird.body.allowGravity = false;
    this.base.body.enable = false;

    const pipeGroups = [this.upperPipes, this.lowerPipes];
    pipeGroups.forEach((group) => {
      group.children.iterate((pipe) => {
        // Stop pipe movement
        pipe.body.velocity.x = 0;
      });
    });


    this.gameOver = true;
    this.scoreText.destroy();

    // Display game over
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 4, Assets.GAME_OVER).setOrigin(0.5);

    const scorePanel = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, Assets.SCORE_PANEL).setOrigin(0.5);
    const finalScore = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT, this.score, {
      fontSize: "32px",
      fontFamily: "Fantasy",
      fill: "white"
    }).setOrigin(0.5);

    // Render the score panel and display the final score
    this.tweens.add({
      targets: [scorePanel, finalScore],
      y: (target) => {
        if (target === scorePanel) {
          return GAME_HEIGHT / 2.2;
        } else {
          return GAME_HEIGHT / 2.1; 
        }
      },

      // Duration of the animation in ms
      duration: 500,
      
      ease: "Power1"
    });


    // Add the retry button below the score panel
    const retryButton = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 1.5, Assets.RETRY)
      .setOrigin(0.5)
      .setScale(0.25)
      .setInteractive();

    // Restart game when retry button clicked
    retryButton.on("pointerdown", () => {
      this.gameStarted = false;
      this.gameOver = false;
      this.score = 0;
      this.speedMultiplier = 1.0; // Reset speed factor
      this.scene.restart();
    });
  }
}

// Phaser game config
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: GRAVITY },
      debug: false
    }
  },
  scene: FlappyBirdScene
};

// Initialize the game with game config
const game = new Phaser.Game(config);
