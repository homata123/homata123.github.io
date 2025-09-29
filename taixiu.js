// Tài Xỉu MD5 Game Logic
class TaiXiuGame {
    constructor() {
        this.gameData = null;
        this.userData = null;
        this.currentUser = null;
        this.gameInterval = null;
        this.countdownInterval = null;
        this.bettingUpdateInterval = null;
        this.isGameActive = false;
        this.userBets = { tai: 0, xiu: 0 };
        this.diceCoverDragged = false;
        this.diceCoverDraggable = false;
        this.isInitializing = false;
        this.joinAttempts = 0;
        this.maxJoinAttempts = 3;
        this.lastJoinAttempt = Date.now();
        this.joinRetryDelay = 5000; // 5 seconds delay between attempts

        // Server-managed game properties
        this.currentGame = null;
        this.gameStartTime = null;
        this.gameDuration = 60; // 60 seconds per game
        this.isJoiningGame = false;

        // API call tracking
        this.hasCalledActiveApi = false;

        this.init();
    }


    async init() {
        // Check if user is logged in
        this.currentUser = window.auth ? window.auth.getCurrentUser() : null;

        if (!this.currentUser) {
            this.showLoginRequired();
            return;
        }

        this.showGameArea();
        await this.loadUserData();
        await this.loadUserStats();
        await this.loadGameHistory(); // Load game history on init
        this.updateUI();
        this.setupDiceCoverDrag();

        // Try to join or start a game (only call API once)
        console.log('🚀 Initializing game, attempting to join or start...');
        await this.joinOrStartGame();

        // Game loop will be started by joinOrStartGame() if successful
        console.log('✅ Game initialization completed');
    }

    showLoginRequired() {
        document.getElementById('loginRequired').style.display = 'block';
        document.getElementById('balanceSection').style.display = 'none';
        document.querySelector('.game-area').style.display = 'none';
    }

    showGameArea() {
        document.getElementById('loginRequired').style.display = 'none';
        document.getElementById('balanceSection').style.display = 'block';
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('historySection').style.display = 'block';
        document.querySelector('.game-area').style.display = 'block';
    }

    // Removed loadGameData - now using server-managed games

    async loadUserData() {
        try {
            // Load user data from API
            const userInfo = await window.auth.getCurrentUserInfo();

            if (userInfo && userInfo.taixiu) {
                this.userData = {
                    email: userInfo.email,
                    balance: userInfo.taixiu.current_money || 20000,
                    games_played: userInfo.taixiu.total_games || 0,
                    games_won: 0, // This will be calculated from recent_games
                    total_bet: 0, // This will be calculated from recent_games
                    total_won: userInfo.taixiu.highest_win || 0,
                    created_at: new Date().toISOString(),
                    recent_games: userInfo.taixiu.recent_games || []
                };

                // Calculate games_won and total_bet from recent_games
                if (userInfo.taixiu.recent_games) {
                    this.userData.games_won = userInfo.taixiu.recent_games.filter(game => game.result).length;
                    this.userData.total_bet = userInfo.taixiu.recent_games.reduce((sum, game) => sum + game.bet_amount, 0);
                }
            } else {
                // Fallback to default data if API fails
                this.userData = {
                    email: this.currentUser.email,
                    balance: 20000,
                    games_played: 0,
                    games_won: 0,
                    total_bet: 0,
                    total_won: 0,
                    created_at: new Date().toISOString(),
                    recent_games: []
                };
            }
        } catch (error) {
            console.error('Error loading user data from API:', error);
            // Fallback to default data
            this.userData = {
                email: this.currentUser.email,
                balance: 20000,
                games_played: 0,
                games_won: 0,
                total_bet: 0,
                total_won: 0,
                created_at: new Date().toISOString(),
                recent_games: []
            };
        }
    }

    async joinOrStartGame() {
        // Don't try to join if we already have an active game
        if (this.currentGame && this.gameData && this.gameData.current_round) {
            console.log('✅ Already have active game, skipping join/start');
            return;
        }

        // Only call API once per session
        if (this.hasCalledActiveApi) {
            console.log('⏳ API already called this session, skipping');
            return;
        }

        try {
            this.isJoiningGame = true;
            this.isInitializing = true;
            console.log('🎮 Attempting to join or start a game...');

            // Mark that we've called the API
            this.hasCalledActiveApi = true;

            // Try to get active game
            let activeGame = null;
            try {
                console.log('🔍 Checking for active game... (API call #1)');
                activeGame = await window.auth.getActiveTaiXiuGame();
                console.log('🔍 Active game check result:', activeGame);
                console.log('🔍 Active game type:', typeof activeGame);
                console.log('🔍 Active game game_id:', activeGame?.game_id);
            } catch (error) {
                console.log('❌ No active game found:', error.message);
                // If it's a 404 error, that means no active game exists
                if (error.message && error.message.includes('404')) {
                    activeGame = null;
                } else {
                    // For other errors, re-throw to be handled below
                    throw error;
                }
            }

            // Check if we have a valid active game
            if (activeGame && activeGame.game_id) {
                console.log('✅ Found active game, joining:', activeGame);
                await this.joinActiveGame(activeGame);
                return; // Exit early, don't start new game
            } else {
                console.log('🆕 No active game found or invalid game data, starting new game...');
                console.log('🆕 activeGame:', activeGame);
                await this.startNewGame();
            }
        } catch (error) {
            console.error('❌ Error joining or starting game:', error);

            // Only try to start new game if we haven't found an active game
            if (!this.currentGame) {
                try {
                    console.log('🔄 Retrying with new game...');
                    await this.startNewGame();
                } catch (startError) {
                    console.error('💥 Failed to start new game:', startError);
                    this.showNotification('Không thể kết nối đến game server: ' + startError.message, 'error');

                    // Fallback: create a local game for testing
                    console.log('🛠️ Creating fallback local game...');
                    this.createFallbackGame();
                }
            } else {
                console.log('✅ Already joined active game, continuing...');
            }
        } finally {
            this.isJoiningGame = false;
            this.isInitializing = false;
        }
    }

    async joinActiveGame(gameData) {
        console.log('🎮 Joining active game with data:', gameData);

        this.currentGame = gameData;
        // Add 7 hours to UTC timestamp to convert to local time
        const utcTimestamp = new Date(gameData.timestamp);
        this.gameStartTime = new Date(utcTimestamp.getTime() + 7 * 60 * 60 * 1000); // +7 hours

        // Calculate remaining time: timestamp + 60 seconds - current time
        const localTimestamp = new Date(utcTimestamp.getTime() + 7 * 60 * 60 * 1000); // +7 hours
        const gameEndTime = new Date(localTimestamp.getTime() + 60 * 1000); // +60 seconds
        const now = new Date();
        const remaining = Math.max(0, Math.floor((gameEndTime - now) / 1000));

        console.log('Joining active game:', {
            gameId: gameData.game_id,
            originalTimestamp: gameData.timestamp,
            localTimestamp: localTimestamp.toISOString(),
            gameEndTime: gameEndTime.toISOString(),
            currentTime: now.toISOString(),
            remaining: remaining,
            tai_bet_amount: gameData.tai_bet_amount,
            xiu_bet_amount: gameData.xiu_bet_amount,
            tai_bettors_count: gameData.tai_bettors_count,
            xiu_bettors_count: gameData.xiu_bettors_count
        });

        // If game is already finished or almost finished, don't join
        if (remaining <= 5) {
            console.log('Game is already finished or almost finished, will start new game instead');
            await this.startNewGame();
            return;
        }

        // Initialize game state
        this.initializeGameState(gameData, remaining);
        console.log('✅ Game state initialized:', this.gameData);
        console.log('✅ Game data after init:', {
            hasGameData: !!this.gameData,
            hasCurrentRound: !!(this.gameData && this.gameData.current_round),
            currentRoundStatus: this.gameData?.current_round?.status
        });

        // Note: initializeGameState already calls startCountdown and startBettingUpdates
        // So we don't need to call them again here

        // Start game monitoring loop (only if not already running)
        if (!this.gameInterval) {
            console.log('🚀 Starting game loop for active game');
            this.startGameLoop();
        } else {
            console.log('⚠️ Game loop already running, skipping start');
        }

        console.log('✅ Successfully joined active game');
    }

    async startNewGame() {
        // Don't start new game if we already have one
        if (this.currentGame && this.gameData && this.gameData.current_round) {
            console.log('✅ Already have active game, skipping start new game');
            return;
        }

        try {
            const md5Hash = this.generateMD5Hash();
            const gameData = await window.auth.startNewTaiXiuGame(md5Hash);

            console.log('Started new game:', gameData);

            this.currentGame = gameData;
            this.gameStartTime = new Date(gameData.timestamp);

            // Initialize game state
            this.initializeGameState(gameData, this.gameDuration);

            // Note: initializeGameState already calls startCountdown and startBettingUpdates
            // So we don't need to call them again here

            // Start game monitoring loop (only if not already running)
            if (!this.gameInterval) {
                this.startGameLoop();
            }

        } catch (error) {
            console.error('Error starting new game:', error);

            // Don't call API again if we already called it
            if (!this.hasCalledActiveApi) {
                // Check if error is due to existing active game
                if (error.message && error.message.includes('There is already an active game')) {
                    console.log('Active game exists, attempting to join...');
                    try {
                        this.hasCalledActiveApi = true;
                        console.log('🔍 Checking for active game... (API call #2 - error handling)');
                        const activeGame = await window.auth.getActiveTaiXiuGame();
                        if (activeGame) {
                            console.log('Found active game, joining:', activeGame);
                            await this.joinActiveGame(activeGame);
                            return;
                        }
                    } catch (checkError) {
                        console.error('Error checking for active game:', checkError);
                    }
                } else {
                    // For other errors, try to check if there's an active game now
                    // (race condition: another user might have started a game)
                    try {
                        this.hasCalledActiveApi = true;
                        console.log('🔍 Checking for active game... (API call #3 - race condition)');
                        const activeGame = await window.auth.getActiveTaiXiuGame();
                        if (activeGame) {
                            console.log('Found active game after failed start, joining:', activeGame);
                            await this.joinActiveGame(activeGame);
                            return;
                        }
                    } catch (checkError) {
                        console.error('Error checking for active game:', checkError);
                    }
                }
            }

            throw error;
        }
    }

    initializeGameState(gameData, countdown) {
        // Initialize local game data
        this.gameData = {
            current_round: {
                round_id: 1,
                status: countdown > 0 ? "counting_down" : "finished",
                countdown: countdown,
                total_bet_tai: gameData.tai_bet_amount ?? 0,
                total_bet_xiu: gameData.xiu_bet_amount ?? 0,
                players_tai: gameData.tai_bettors_count ?? 0,
                players_xiu: gameData.xiu_bettors_count ?? 0,
                result: gameData.result,
                dice_result: null,
                md5_hash: gameData.md5_hash
            },
            game_history: [],
            metadata: {
                total_rounds: 0,
                last_updated: new Date().toISOString(),
                version: "2.0"
            }
        };

        // Reset user bets
        this.userBets = { tai: 0, xiu: 0 };
        this.diceCoverDragged = false;
        this.diceCoverDraggable = false;

        // Reset UI elements to initial state
        this.resetUIForNewGame();

        this.updateUI();

        // Start countdown if game is in counting_down state
        if (countdown > 0) {
            console.log('Starting countdown for new game:', countdown);
            this.startCountdown(countdown);
            this.startBettingUpdates();
        }
    }

    resetUIForNewGame() {
        console.log('Resetting UI for new game...');

        // Reset dice cover - hide dice result and show cover
        const diceResult = document.getElementById('diceResult');
        const diceCover = document.getElementById('diceCover');

        if (diceResult) {
            diceResult.style.display = 'none';
            diceResult.style.opacity = '0';
            diceResult.style.transform = 'translate(-50%, -50%) scale(0.5)';
        }

        if (diceCover) {
            diceCover.style.display = 'block';
            diceCover.style.opacity = '1';
            diceCover.style.top = '50%';
            diceCover.style.left = '50%';
            diceCover.style.transform = 'translate(-50%, -50%) scale(1)';
            diceCover.classList.remove('dragging');
        }

        // Clear result announcement
        const resultAnnouncement = document.getElementById('resultAnnouncement');
        if (resultAnnouncement) {
            resultAnnouncement.style.display = 'none';
            resultAnnouncement.textContent = '';
            resultAnnouncement.className = 'result-announcement';
        }

        // Reset dice faces to default
        const dice1 = document.getElementById('dice1');
        const dice2 = document.getElementById('dice2');
        const dice3 = document.getElementById('dice3');
        const diceTotal = document.getElementById('diceTotal');
        const diceResultDisplay = document.getElementById('diceResultDisplay');
        const diceOutcome = document.getElementById('diceOutcome');

        if (dice1) dice1.innerHTML = '1';
        if (dice2) dice2.innerHTML = '2';
        if (dice3) dice3.innerHTML = '3';
        if (diceTotal) diceTotal.textContent = 'Tổng: 6';
        if (diceResultDisplay) diceResultDisplay.style.display = 'none';
        if (diceOutcome) {
            diceOutcome.textContent = '';
            diceOutcome.className = 'dice-outcome';
        }

        // Reset betting buttons
        const taiButton = document.getElementById('taiButton');
        const xiuButton = document.getElementById('xiuButton');

        if (taiButton) {
            taiButton.style.background = '';
            taiButton.textContent = 'CƯỢC';
            taiButton.disabled = false;
        }

        if (xiuButton) {
            xiuButton.style.background = '';
            xiuButton.textContent = 'CƯỢC';
            xiuButton.disabled = false;
        }

        // Reset user bet displays
        const userTaiBet = document.getElementById('userTaiBet');
        const userXiuBet = document.getElementById('userXiuBet');

        if (userTaiBet) userTaiBet.textContent = '$0';
        if (userXiuBet) userXiuBet.textContent = '$0';

        console.log('UI reset completed');
    }

    createFallbackGame() {
        console.log('🛠️ Creating fallback local game...');

        // Create a local game for testing when API fails
        const md5Hash = this.generateMD5Hash();
        const now = new Date();

        this.currentGame = {
            game_id: 'LOCAL_' + Date.now(),
            md5_hash: md5Hash,
            timestamp: now.toISOString(),
            tai_bet_amount: 0,
            xiu_bet_amount: 0,
            tai_bettors_count: 0,
            xiu_bettors_count: 0,
            result: null,
            is_finished: false
        };

        this.gameStartTime = now;

        // Initialize game state with 60 seconds
        this.initializeGameState(this.currentGame, 60);

        // Note: initializeGameState already calls startCountdown and startBettingUpdates
        // So we don't need to call them again here

        console.log('✅ Fallback game created and started');
    }

    // Removed saveGameData and downloadGameData - now using server-managed games

    // Removed getDefaultGameData - now using server-managed games

    startGameLoop() {
        // Only start if not already running
        if (this.gameInterval) {
            console.log('🔄 Game loop already running, skipping start');
            return;
        }

        console.log('🚀 Starting game loop...');
        this.gameInterval = setInterval(() => {
            this.updateGameState();
        }, 1000);
    }

    stopGameLoop() {
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
        console.log('🛑 Game loop stopped');
    }

    showWaitingState() {
        // Show waiting state in UI
        const gameStatusEl = document.getElementById('gameStatus');
        if (gameStatusEl) {
            gameStatusEl.textContent = 'Đang chờ kết nối...';
        }

        const countdownTimerEl = document.getElementById('countdownTimer');
        if (countdownTimerEl) {
            countdownTimerEl.textContent = '--:--';
        }

        // Show new game button for manual retry
        this.showNewGameButton();
    }

    async updateGameState() {
        console.log('🔍 updateGameState called - Current state:', {
            hasGameData: !!this.gameData,
            hasCurrentRound: !!(this.gameData && this.gameData.current_round),
            currentGame: !!this.currentGame,
            gameInterval: !!this.gameInterval
        });

        // If we already have an active game, just update the countdown
        if (this.gameData && this.gameData.current_round) {
            const round = this.gameData.current_round;
            console.log('✅ Have active game, updating countdown:', round.status, 'countdown:', round.countdown);

            if (round.status === "counting_down") {
                this.updateCountdown();
            } else if (round.status === "revealing") {
                // Game is revealing results - no need to call API
                console.log('🎲 Game is revealing results, no API call needed');
            } else if (round.status === "finished") {
                // Round finished, show new game button instead of auto-joining
                console.log('🏁 Game finished, showing new game button...');
                this.showNewGameButton();
                // Stop the game loop when game is finished
                this.stopGameLoop();
            }
            return;
        }

        // If no game data, show waiting state
        if (!this.gameData || !this.gameData.current_round) {
            console.log('⚠️ No game data available, showing waiting state');
            this.showWaitingState();
        }
    }

    forceStartNewRound() {
        // Force start a new round regardless of current status
        const round = this.gameData.current_round;
        round.status = "betting";
        round.countdown = 90; // 1 minute 30 seconds
        round.total_bet_tai = this.generateRandomBetAmount();
        round.total_bet_xiu = this.generateRandomBetAmount();
        round.players_tai = this.generateRandomPlayerCount();
        round.players_xiu = this.generateRandomPlayerCount();
        round.result = null;
        round.dice_result = null;
        round.md5_hash = this.generateMD5Hash();
        this.userBets = { tai: 0, xiu: 0 };
        this.diceCoverDragged = false;
        this.diceCoverDraggable = false;

        // Reset dice result display
        const diceResult = document.getElementById('diceResult');
        if (diceResult) {
            diceResult.style.display = 'none';
            diceResult.style.opacity = '0';
            diceResult.style.transform = 'translate(-50%, -50%) scale(0.5)';
        }

        this.updateUI();
        this.startCountdown();
        this.startBettingUpdates();

        console.log('Force started new round:', round);
    }

    startNewRound() {
        const round = this.gameData.current_round;

        if (round.status === "waiting") {
            round.status = "betting";
            round.countdown = 90; // 1 minute 30 seconds
            round.total_bet_tai = this.generateRandomBetAmount();
            round.total_bet_xiu = this.generateRandomBetAmount();
            round.players_tai = this.generateRandomPlayerCount();
            round.players_xiu = this.generateRandomPlayerCount();
            round.result = null;
            round.dice_result = null;
            round.md5_hash = this.generateMD5Hash();
            this.userBets = { tai: 0, xiu: 0 };
            this.diceCoverDragged = false;
            this.diceCoverDraggable = false;

            // Reset dice result display
            const diceResult = document.getElementById('diceResult');
            if (diceResult) {
                diceResult.style.display = 'none';
                diceResult.style.opacity = '0';
                diceResult.style.transform = 'translate(-50%, -50%) scale(0.5)';
            }

            this.updateUI();
            this.startCountdown();
            this.startBettingUpdates();

            console.log('New round started:', round);
        }
    }

    generateRandomBetAmount() {
        // Generate random bet amount between 500,000 and 2,000,000
        return Math.floor(Math.random() * 1500000) + 500000;
    }

    generateRandomPlayerCount() {
        // Generate random player count between 1000 and 3000
        return Math.floor(Math.random() * 2000) + 1000;
    }

    startBettingUpdates() {
        // Clear existing betting update interval first
        if (this.bettingUpdateInterval) {
            clearInterval(this.bettingUpdateInterval);
            this.bettingUpdateInterval = null;
        }

        console.log('💰 Starting betting updates every 2 seconds');
        // Update betting amounts and player counts every 2 seconds
        this.bettingUpdateInterval = setInterval(() => {
            if (this.gameData && this.gameData.current_round &&
                (this.gameData.current_round.status === "betting" || this.gameData.current_round.status === "counting_down")) {
                this.updateBettingAmounts();
            }
        }, 2000);
    }

    updateBettingAmounts() {
        const round = this.gameData.current_round;

        // Add larger random changes to betting amounts for more dramatic differences
        const taiChange = Math.floor(Math.random() * 100000) - 50000; // -50k to +50k
        const xiuChange = Math.floor(Math.random() * 100000) - 50000;

        round.total_bet_tai = Math.max(500000, round.total_bet_tai + taiChange);
        round.total_bet_xiu = Math.max(500000, round.total_bet_xiu + xiuChange);

        // Add larger random changes to player counts
        const taiPlayerChange = Math.floor(Math.random() * 100) - 50; // -50 to +50
        const xiuPlayerChange = Math.floor(Math.random() * 100) - 50;

        round.players_tai = Math.max(1000, round.players_tai + taiPlayerChange);
        round.players_xiu = Math.max(1000, round.players_xiu + xiuPlayerChange);

        this.updateUI();
    }

    generateMD5Hash() {
        // Generate a fake MD5 hash for demonstration
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    startCountdown(initialCountdown = null) {
        // Clear existing countdown interval first
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        const round = this.gameData.current_round;
        round.status = "counting_down";

        if (initialCountdown !== null) {
            round.countdown = initialCountdown;
        }

        console.log('⏰ Starting countdown with:', round.countdown, 'seconds');
        this.countdownInterval = setInterval(() => {
            round.countdown--;
            this.updateCountdownUI();

            if (round.countdown <= 0) {
                this.endBetting();
            }
        }, 1000);
    }

    updateCountdown() {
        this.updateCountdownUI();
    }

    updateCountdownUI() {
        const round = this.gameData.current_round;
        const minutes = Math.floor(round.countdown / 60);
        const seconds = round.countdown % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('countdownTimer').textContent = timeString;

        if (round.countdown <= 10) {
            document.getElementById('countdownTimer').style.color = '#e74c3c';
            document.getElementById('countdownTimer').style.animation = 'pulse 0.5s infinite';
        } else {
            document.getElementById('countdownTimer').style.color = '';
            document.getElementById('countdownTimer').style.animation = '';
        }
    }

    async endBetting() {
        const round = this.gameData.current_round;
        round.status = "revealing";

        clearInterval(this.countdownInterval);
        clearInterval(this.bettingUpdateInterval);

        // Disable betting buttons
        const taiButton = document.getElementById('taiButton');
        const xiuButton = document.getElementById('xiuButton');
        if (taiButton) taiButton.disabled = true;
        if (xiuButton) xiuButton.disabled = true;

        // Generate dice result
        this.generateDiceResult();

        // Finish the game on server
        await this.finishGameOnServer();

        // Show dice cover and enable dragging
        this.showDiceCover();
    }

    async finishGameOnServer() {
        if (!this.currentGame) {
            console.warn('No current game to finish');
            return;
        }

        try {
            const round = this.gameData.current_round;
            const result = this.getGameResult();

            const finishData = await window.auth.finishTaiXiuGame(
                this.currentGame.game_id,
                result,
                this.userBets.tai,
                this.userBets.xiu
            );

            console.log('Game finished on server:', finishData);

            // Update local game data with server response
            this.currentGame = finishData;

        } catch (error) {
            console.error('Error finishing game on server:', error);

            // Handle case where game is already finished by another user
            if (error.message && error.message.includes('Game is already finished')) {
                console.log('Game was already finished by another user, continuing locally...');
            }
            // Continue with local game even if server fails
        }
    }

    getGameResult() {
        const round = this.gameData.current_round;
        if (round.result === "triple") {
            return "triple";
        } else if (round.result === "tai") {
            return "tai";
        } else {
            return "xiu";
        }
    }

    generateDiceResult() {
        const round = this.gameData.current_round;

        // Use result_string from server to generate consistent dice results
        let dice1, dice2, dice3;

        if (this.currentGame && this.currentGame.result_string) {
            const diceValues = this.parseResultString(this.currentGame.result_string);
            dice1 = diceValues[0];
            dice2 = diceValues[1];
            dice3 = diceValues[2];
        } else {
            // Fallback to random if no result_string available
            console.warn('No genXXXX available, using random fallback');
            dice1 = Math.floor(Math.random() * 6) + 1;
            dice2 = Math.floor(Math.random() * 6) + 1;
            dice3 = Math.floor(Math.random() * 6) + 1;
        }

        const total = dice1 + dice2 + dice3;

        round.dice_result = [dice1, dice2, dice3];

        // Determine result
        if (dice1 === dice2 && dice2 === dice3) {
            // Triple - house wins
            round.result = "triple";
        } else if (total >= 11) {
            round.result = "tai";
        } else {
            round.result = "xiu";
        }

        console.log(`🎲 Yup: 564`);
    }

    parseResultString(resultString) {
        // Convert result_string to consistent dice values
        // Use character codes to generate deterministic values
        let seed = 0;
        for (let i = 0; i < resultString.length; i++) {
            seed += resultString.charCodeAt(i) * (i + 1);
        }

        // Use a simple linear congruential generator for deterministic pseudo-random values
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);

        // Generate three different seeds for each dice
        const seed1 = (a * seed + c) % m;
        const seed2 = (a * seed1 + c) % m;
        const seed3 = (a * seed2 + c) % m;

        // Convert to dice values (1-6)
        const dice1 = (seed1 % 6) + 1;
        const dice2 = (seed2 % 6) + 1;
        const dice3 = (seed3 % 6) + 1;

        // console.log(`🔢 Parsed result_string "${resultString}" -> seeds: ${seed1}, ${seed2}, ${seed3} -> dice: [${dice1}, ${dice2}, ${dice3}]`);

        return [dice1, dice2, dice3];
    }

    // Test function to verify consistency (can be called from console)
    testResultStringConsistency(resultString, iterations = 5) {
        console.log(`🧪 Testing consistency for rYup: Yup`);
        const results = [];

        for (let i = 0; i < iterations; i++) {
            const dice = this.parseResultString(resultString);
            results.push(dice);
            console.log(`Iteration ${i + 1}: [${dice[0]}, ${dice[1]}, ${dice[2]}]`);
        }

        // Check if all results are the same
        const firstResult = results[0];
        const allSame = results.every(result =>
            result[0] === firstResult[0] &&
            result[1] === firstResult[1] &&
            result[2] === firstResult[2]
        );

        console.log(`✅ Consistency test ${allSame ? 'PASSED' : 'FAILED'}: All ${iterations} iterations produced the same result`);
        return allSame;
    }

    // Soi Cầu functionality
    showSoiCauModal() {
        const modal = document.getElementById('soiCauModal');
        modal.style.display = 'block';
        this.loadChartData();
    }

    closeSoiCauModal() {
        const modal = document.getElementById('soiCauModal');
        modal.style.display = 'none';
    }

    async loadChartData() {
        const chartContainer = document.getElementById('chartContainer');
        const pageSize = document.getElementById('pageSizeSelect').value;

        try {
            chartContainer.innerHTML = '<div class="loading">⏳ Đang tải dữ liệu...</div>';

            const data = await window.getPublicGameHistory(1, parseInt(pageSize));

            if (data.results && data.results.length > 0) {
                this.renderChart(data.results);
            } else {
                chartContainer.innerHTML = '<div class="error">Không có dữ liệu lịch sử</div>';
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
            chartContainer.innerHTML = '<div class="error">Lỗi tải dữ liệu: ' + error.message + '</div>';
        }
    }

    renderChart(games) {
        const chartContainer = document.getElementById('chartContainer');

        // Sort games by order (descending to show newest first)
        const sortedGames = games.sort((a, b) => b.order - a.order);

        const chartHTML = `
            <div class="chart">
                <!-- Game Numbers Row -->
                <div class="chart-row">
                    <div class="chart-row-label">Ván</div>
                    <div class="chart-row-content">
                        ${sortedGames.map((game, index) => `<div class="game-number" data-index="${index}">${game.order}</div>`).join('')}
                    </div>
                </div>
                
                <!-- Tài Row -->
                <div class="chart-row">
                    <div class="chart-row-label">Tài</div>
                    <div class="chart-row-content">
                        ${sortedGames.map((game, index) =>
            `<div class="result-circle ${game.result === 'tai' ? 'tai' : ''}" 
                                 data-index="${index}"
                                 style="opacity: ${game.result === 'tai' ? '1' : '0.3'}"></div>`
        ).join('')}
                    </div>
                </div>
                
                <!-- Xỉu Row -->
                <div class="chart-row">
                    <div class="chart-row-label">Xỉu</div>
                    <div class="chart-row-content">
                        ${sortedGames.map((game, index) =>
            `<div class="result-circle ${game.result === 'xiu' ? 'xiu' : ''}" 
                                 data-index="${index}"
                                 style="opacity: ${game.result === 'xiu' ? '1' : '0.3'}"></div>`
        ).join('')}
                    </div>
                </div>
            </div>
        `;

        chartContainer.innerHTML = chartHTML;

        // Add connection lines after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.addConnectionLines(sortedGames);
        }, 100);
    }

    addConnectionLines(games) {
        const taiRow = document.querySelector('.chart-row:nth-child(2) .chart-row-content');
        const xiuRow = document.querySelector('.chart-row:nth-child(3) .chart-row-content');

        if (!taiRow || !xiuRow) return;

        const taiCircles = taiRow.querySelectorAll('.result-circle');
        const xiuCircles = xiuRow.querySelectorAll('.result-circle');

        // Clear existing lines
        const existingLines = document.querySelectorAll('.connection-line');
        existingLines.forEach(line => line.remove());

        // Find all circles with actual results (colored circles) and sort by their data-index
        const coloredCircles = [];
        for (let i = 0; i < games.length; i++) {
            const game = games[i];
            const circle = game.result === 'tai' ? taiCircles[i] : xiuCircles[i];
            if (circle && circle.style.opacity === '1') {
                const dataIndex = parseInt(circle.getAttribute('data-index'));
                coloredCircles.push({
                    dataIndex: dataIndex,
                    game: game,
                    circle: circle,
                    row: game.result === 'tai' ? taiRow : xiuRow
                });
            }
        }

        // Sort by data-index to ensure correct order
        coloredCircles.sort((a, b) => a.dataIndex - b.dataIndex);

        // Connect consecutive colored circles
        for (let i = 0; i < coloredCircles.length - 1; i++) {
            const current = coloredCircles[i];
            const next = coloredCircles[i + 1];

            if (current.game.result === next.game.result) {
                // Same result - horizontal line in the same row
                this.addHorizontalLine(current.dataIndex, next.dataIndex, current.row);
            } else {
                // Different result - diagonal line between rows
                this.addDiagonalLineBetweenRows(current.dataIndex, next.dataIndex, taiRow, xiuRow, current.game.result, next.game.result);
            }
        }
    }

    addHorizontalLine(fromIndex, toIndex, row) {
        const fromCircle = row.querySelector(`[data-index="${fromIndex}"]`);
        const toCircle = row.querySelector(`[data-index="${toIndex}"]`);

        if (!fromCircle || !toCircle) return;

        const fromRect = fromCircle.getBoundingClientRect();
        const toRect = toCircle.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();

        const line = document.createElement('div');
        line.className = 'connection-line';
        line.style.left = `${fromRect.right - rowRect.left}px`;
        line.style.width = `${toRect.left - fromRect.right}px`;

        row.appendChild(line);
    }

    addDiagonalLineBetweenRows(fromIndex, toIndex, taiRow, xiuRow, fromResult, toResult) {
        const fromRow = fromResult === 'tai' ? taiRow : xiuRow;
        const toRow = toResult === 'tai' ? taiRow : xiuRow;

        const fromCircle = fromRow.querySelector(`[data-index="${fromIndex}"]`);
        const toCircle = toRow.querySelector(`[data-index="${toIndex}"]`);

        if (!fromCircle || !toCircle) return;

        // Get positions relative to the chart container
        const chartContainer = document.getElementById('chartContainer');
        const chartRect = chartContainer.getBoundingClientRect();

        const fromRect = fromCircle.getBoundingClientRect();
        const toRect = toCircle.getBoundingClientRect();

        // Calculate positions relative to chart container
        const startX = fromRect.left + fromRect.width / 2 - chartRect.left;
        const startY = fromRect.top + fromRect.height / 2 - chartRect.top;
        const endX = toRect.left + toRect.width / 2 - chartRect.left;
        const endY = toRect.top + toRect.height / 2 - chartRect.top;

        // Calculate line properties
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

        // Create line element
        const line = document.createElement('div');
        line.className = `connection-line ${fromResult === 'tai' ? 'diagonal-down' : 'diagonal-up'}`;

        // Position the line
        line.style.position = 'absolute';
        line.style.left = `${startX}px`;
        line.style.top = `${startY}px`;
        line.style.width = `${length}px`;
        line.style.height = '3px';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.transformOrigin = '0 50%';
        line.style.zIndex = '1';

        // Add to chart container
        chartContainer.appendChild(line);
    }

    changePageSize() {
        this.loadChartData();
    }

    refreshChart() {
        this.loadChartData();
    }

    showDiceCover() {
        const diceCover = document.getElementById('diceCover');
        const diceResult = document.getElementById('diceResult');
        const diceResultDisplay = document.getElementById('diceResultDisplay');

        // Show dice result but keep it hidden behind cover
        diceResult.style.display = 'block';
        diceCover.style.display = 'flex';
        // Keep dice cover centered on bowl - don't move it
        diceCover.style.top = '50%';
        diceCover.style.left = '50%';
        diceCover.style.transform = 'translate(-50%, -50%)';
        diceCover.style.transition = '';

        // Hide result display initially
        if (diceResultDisplay) {
            diceResultDisplay.style.display = 'none';
        }

        // Enable dragging
        this.diceCoverDraggable = true;

        // Show dice faces immediately but hidden behind cover
        const round = this.gameData.current_round;
        this.displayDiceFace(document.getElementById('dice1'), round.dice_result[0]);
        this.displayDiceFace(document.getElementById('dice2'), round.dice_result[1]);
        this.displayDiceFace(document.getElementById('dice3'), round.dice_result[2]);

        // Don't show total yet - will show after dragging
        const total = round.dice_result.reduce((a, b) => a + b, 0);
        document.getElementById('diceTotal').textContent = `Tổng: ${total}`;
    }

    async showDiceResult() {
        const round = this.gameData.current_round;
        const diceResult = document.getElementById('diceResult');
        const diceCover = document.getElementById('diceCover');

        // Show dice faces with dots
        this.displayDiceFace(document.getElementById('dice1'), round.dice_result[0]);
        this.displayDiceFace(document.getElementById('dice2'), round.dice_result[1]);
        this.displayDiceFace(document.getElementById('dice3'), round.dice_result[2]);

        const total = round.dice_result.reduce((a, b) => a + b, 0);
        document.getElementById('diceTotal').textContent = `Tổng: ${total}`;

        // Show result
        diceResult.style.display = 'block';
        diceCover.style.display = 'none';

        // Disable dragging
        this.diceCoverDraggable = false;

        // Show announcement
        this.showResultAnnouncement();

        // Process winnings
        await this.processWinnings();

        // Add to history
        this.addToHistory();

        // Update round status
        round.status = "finished";

        // Show new game button
        this.showNewGameButton();

        // Re-enable betting buttons for next round
        setTimeout(() => {
            document.getElementById('taiButton').disabled = false;
            document.getElementById('xiuButton').disabled = false;
        }, 3000);
    }

    displayDiceFace(element, value) {
        const dots = this.getDiceDots(value);
        element.innerHTML = dots;
    }

    getDiceDots(value) {
        const dotPatterns = {
            1: '<div class="dot-center"></div>',
            2: '<div class="dot-top-left"></div><div class="dot-bottom-right"></div>',
            3: '<div class="dot-top-left"></div><div class="dot-center"></div><div class="dot-bottom-right"></div>',
            4: '<div class="dot-top-left"></div><div class="dot-top-right"></div><div class="dot-bottom-left"></div><div class="dot-bottom-right"></div>',
            5: '<div class="dot-top-left"></div><div class="dot-top-right"></div><div class="dot-center"></div><div class="dot-bottom-left"></div><div class="dot-bottom-right"></div>',
            6: '<div class="dot-top-left"></div><div class="dot-top-right"></div><div class="dot-middle-left"></div><div class="dot-middle-right"></div><div class="dot-bottom-left"></div><div class="dot-bottom-right"></div>'
        };
        return dotPatterns[value] || '';
    }

    showResultAnnouncement() {
        const round = this.gameData.current_round;
        const announcement = document.getElementById('resultAnnouncement');

        let message = '';
        let className = '';

        if (round.result === "triple") {
            message = '🎲 BỘ BA! Nhà cái thắng!';
            className = 'result-triple';
        } else if (round.result === "tai") {
            message = '🔴 TÀI THẮNG!';
            className = 'result-tai';
        } else {
            message = '🔵 XỈU THẮNG!';
            className = 'result-xiu';
        }

        announcement.textContent = message;
        announcement.className = `result-announcement ${className}`;
        announcement.style.display = 'block';
    }

    async processWinnings() {
        const round = this.gameData.current_round;
        const userEmail = this.currentUser.email;
        let winAmount = 0;
        let message = '';
        let gameResult = false;
        let totalBetAmount = this.userBets.tai + this.userBets.xiu;

        if (round.result === "triple") {
            // House wins - user loses all bets
            this.userData.balance -= totalBetAmount;
            this.userData.total_bet += totalBetAmount;
            message = `🎲 BỘ BA! Bạn thua $${totalBetAmount.toLocaleString()}`;
            gameResult = false;
        } else {
            // Check if user won
            const userWon = (round.result === "tai" && this.userBets.tai > 0) ||
                (round.result === "xiu" && this.userBets.xiu > 0);

            if (userWon) {
                winAmount = round.result === "tai" ? this.userBets.tai : this.userBets.xiu;
                this.userData.balance += winAmount; // 1:1 payout
                this.userData.total_won += winAmount;
                this.userData.games_won++;
                message = `🎉 THẮNG! Bạn thắng $${winAmount.toLocaleString()}`;
                gameResult = true;
            } else {
                // User lost
                this.userData.balance -= totalBetAmount;
                this.userData.total_bet += totalBetAmount;
                message = `😢 THUA! Bạn thua $${totalBetAmount.toLocaleString()}`;
                gameResult = false;
            }
        }

        this.userData.games_played++;

        // Record game result to API
        try {
            await this.recordGameToAPI(totalBetAmount, gameResult, round.md5_hash);
        } catch (error) {
            console.error('Error recording game to API:', error);
            // Continue with local processing even if API fails
        }

        this.updateUI();

        // Show detailed result message
        setTimeout(() => {
            this.showNotification(message, winAmount > 0 ? 'success' : 'error');
        }, 1000);
    }

    async recordGameToAPI(betAmount, result, md5Hash) {
        try {
            // Determine bet type and amount
            let betType = null;
            let betAmount = 0;

            if (this.userBets.tai > 0) {
                betType = 'tai';
                betAmount = this.userBets.tai;
            } else if (this.userBets.xiu > 0) {
                betType = 'xiu';
                betAmount = this.userBets.xiu;
            }

            // Only call API if user actually placed a bet
            if (betType && betAmount > 0) {
                const response = await window.auth.updateUserAfterGame(
                    this.currentGame.game_id,
                    betType,
                    betAmount,
                    result
                );

                if (response && response.taixiu) {
                    // Update local user data with server response
                    this.userData.balance = response.taixiu.current_money;
                    this.userData.games_played = response.taixiu.total_games;
                    this.userData.total_won = response.taixiu.highest_win;
                    this.userData.recent_games = response.taixiu.recent_games || [];

                    // Recalculate stats from recent games
                    if (this.userData.recent_games) {
                        this.userData.games_won = this.userData.recent_games.filter(game => game.result).length;
                        this.userData.total_bet = this.userData.recent_games.reduce((sum, game) => sum + game.bet_amount, 0);
                    }

                    console.log('User data updated from server:', this.userData);
                }
            } else {
                console.log('No bet placed, skipping user update API call');
            }
        } catch (error) {
            console.error('Error updating user after game:', error);
            // Continue with local processing even if API fails
        }
    }

    addToHistory() {
        const round = this.gameData.current_round;
        const historyEntry = {
            round_id: round.round_id,
            result: round.result,
            dice_result: round.dice_result,
            timestamp: new Date().toISOString()
        };

        this.gameData.game_history.unshift(historyEntry);

        // Keep only last 20 results
        if (this.gameData.game_history.length > 20) {
            this.gameData.game_history = this.gameData.game_history.slice(0, 20);
        }

        this.updateHistoryUI();
    }

    updateHistoryUI() {
        const historyDots = document.getElementById('historyDots');
        historyDots.innerHTML = '';

        this.gameData.game_history.slice(0, 10).forEach(entry => {
            const dot = document.createElement('div');
            dot.className = `history-dot ${entry.result}`;
            dot.title = `Ván ${entry.round_id}: ${entry.result.toUpperCase()}`;
            historyDots.appendChild(dot);
        });
    }

    async placeBet(type) {
        if (!this.gameData || !this.gameData.current_round) {
            this.showNotification('Game chưa sẵn sàng!', 'error');
            return;
        }

        if (this.gameData.current_round.status !== "betting" && this.gameData.current_round.status !== "counting_down") {
            this.showNotification('Không thể cược lúc này!', 'error');
            return;
        }

        const betAmount = parseInt(document.getElementById('betAmount').value);

        // Check if bet amount is a valid positive integer
        if (isNaN(betAmount) || betAmount < 1 || !Number.isInteger(betAmount)) {
            this.showNotification('Số tiền cược phải là số nguyên dương!', 'error');
            return;
        }

        // Check if user has enough balance (including any previous bets)
        const totalCurrentBets = this.userBets.tai + this.userBets.xiu;
        const availableBalance = this.userData.balance + totalCurrentBets;

        if (betAmount > availableBalance) {
            this.showNotification(`Số dư không đủ! Số dư hiện tại: $${availableBalance.toLocaleString()}`, 'error');
            return;
        }

        // Reset previous bets and return money to balance
        this.userData.balance += totalCurrentBets;
        this.gameData.current_round.total_bet_tai -= this.userBets.tai;
        this.gameData.current_round.total_bet_xiu -= this.userBets.xiu;

        // Reset user bets
        this.userBets = { tai: 0, xiu: 0 };

        // Place new bet
        this.userBets[type] = betAmount;
        this.userData.balance -= betAmount;

        // Update game data
        this.gameData.current_round[`total_bet_${type}`] += betAmount;

        this.updateUI();

        // Show confirmation
        this.showNotification(`Đã cược $${betAmount.toLocaleString()} vào ${type.toUpperCase()}!`, 'success');

        // Visual feedback
        const button = document.getElementById(`${type}Button`);
        if (button) {
            button.style.background = 'linear-gradient(45deg, #27ae60, #2ecc71)';
            button.textContent = 'ĐÃ CƯỢC';
            setTimeout(() => {
                button.style.background = '';
                button.textContent = 'CƯỢC';
            }, 2000);
        }

        // Reset other button
        const otherType = type === 'tai' ? 'xiu' : 'tai';
        const otherButton = document.getElementById(`${otherType}Button`);
        if (otherButton) {
            otherButton.style.background = '';
            otherButton.textContent = 'CƯỢC';
        }
    }

    setBetAmount(amount) {
        document.getElementById('betAmount').value = amount;
    }

    setAllIn() {
        if (this.userData && this.userData.balance) {
            // Calculate available balance including any current bets
            const totalCurrentBets = this.userBets.tai + this.userBets.xiu;
            const availableBalance = this.userData.balance + totalCurrentBets;
            document.getElementById('betAmount').value = availableBalance;
        }
    }

    updateUI() {
        // Ensure userData exists
        if (!this.userData) {
            console.warn('userData not initialized, using default values');
            this.userData = {
                balance: 20000,
                games_played: 0,
                games_won: 0
            };
        }

        // Update balance
        const userBalanceEl = document.getElementById('userBalance');
        if (userBalanceEl) {
            userBalanceEl.textContent = `$${this.userData.balance.toLocaleString()}`;
        }

        // Update bet amount input placeholder and max
        const betAmountEl = document.getElementById('betAmount');
        if (betAmountEl) {
            const totalCurrentBets = this.userBets.tai + this.userBets.xiu;
            const availableBalance = this.userData.balance + totalCurrentBets;
            betAmountEl.placeholder = `Tối đa: $${availableBalance.toLocaleString()}`;
            betAmountEl.max = availableBalance;
        }

        const gamesPlayedEl = document.getElementById('gamesPlayed');
        if (gamesPlayedEl) {
            gamesPlayedEl.textContent = this.userData.games_played;
        }

        const gamesWonEl = document.getElementById('gamesWon');
        if (gamesWonEl) {
            gamesWonEl.textContent = this.userData.games_won;
        }

        // Check if gameData exists before accessing current_round
        if (!this.gameData || !this.gameData.current_round) {
            console.log('Game data not available yet, skipping round updates');
            return;
        }

        // Update round info
        const roundNumberEl = document.getElementById('roundNumber');
        if (roundNumberEl) {
            roundNumberEl.textContent = this.gameData.current_round.round_id;
        }

        // Update betting amounts
        const taiAmountEl = document.getElementById('taiAmount');
        if (taiAmountEl) {
            taiAmountEl.textContent = `$${this.gameData.current_round.total_bet_tai.toLocaleString()}`;
        }

        const xiuAmountEl = document.getElementById('xiuAmount');
        if (xiuAmountEl) {
            xiuAmountEl.textContent = `$${this.gameData.current_round.total_bet_xiu.toLocaleString()}`;
        }

        // Update player counts
        const taiPlayersEl = document.getElementById('taiPlayers');
        if (taiPlayersEl) {
            taiPlayersEl.textContent = this.gameData.current_round.players_tai || 0;
        }

        const xiuPlayersEl = document.getElementById('xiuPlayers');
        if (xiuPlayersEl) {
            xiuPlayersEl.textContent = this.gameData.current_round.players_xiu || 0;
        }

        // Update user bets
        const userTaiBetEl = document.getElementById('userTaiBet');
        if (userTaiBetEl) {
            userTaiBetEl.textContent = `$${this.userBets.tai}`;
        }

        const userXiuBetEl = document.getElementById('userXiuBet');
        if (userXiuBetEl) {
            userXiuBetEl.textContent = `$${this.userBets.xiu}`;
        }

        // Update MD5 hash
        const md5HashEl = document.getElementById('md5Hash');
        if (md5HashEl) {
            md5HashEl.textContent = this.gameData.current_round.md5_hash;
        }

        // Update result_string display if available
        if (this.currentGame && this.currentGame.result_string) {
            console.log(`🎯 Current game yup: Yup`);
        }

        // Update game status
        const statusText = {
            "waiting": "Đang chờ...",
            "betting": "Đang cược...",
            "counting_down": "Đang đếm ngược...",
            "revealing": "Đang lắc xúc xắc...",
            "finished": "Kết thúc ván"
        };
        const gameStatusEl = document.getElementById('gameStatus');
        if (gameStatusEl) {
            gameStatusEl.textContent = statusText[this.gameData.current_round.status] || "Đang chờ...";
        }

        // Update betting buttons
        const canBet = (this.gameData.current_round.status === "betting" || this.gameData.current_round.status === "counting_down") && this.userData.balance > 0;
        const taiButtonEl = document.getElementById('taiButton');
        if (taiButtonEl) {
            taiButtonEl.disabled = !canBet;
        }
        const xiuButtonEl = document.getElementById('xiuButton');
        if (xiuButtonEl) {
            xiuButtonEl.disabled = !canBet;
        }

        console.log('UI updated:', {
            status: this.gameData.current_round.status,
            countdown: this.gameData.current_round.countdown,
            canBet: canBet,
            balance: this.userData.balance
        });
    }

    copyMD5() {
        const md5Hash = document.getElementById('md5Hash').textContent;
        navigator.clipboard.writeText(md5Hash).then(() => {
            this.showNotification('Đã copy MD5 hash!', 'success');
        }).catch(() => {
            this.showNotification('Không thể copy!', 'error');
        });
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    // Drag and drop functionality for dice cover
    setupDiceCoverDrag() {
        const diceCover = document.getElementById('diceCover');

        diceCover.addEventListener('mousedown', (e) => {
            if (!this.diceCoverDraggable || !this.gameData || !this.gameData.current_round || this.gameData.current_round.status !== "revealing") return;

            e.preventDefault();
            this.diceCoverDragged = true;
            diceCover.classList.add('dragging');

            const startY = e.clientY;
            // Get current position from computed style, not offsetTop
            const currentTop = parseInt(diceCover.style.top) || 0;
            const startTop = currentTop;
            let currentNewTop = startTop; // Track current position

            const handleMouseMove = (e) => {
                const deltaY = e.clientY - startY;
                currentNewTop = Math.max(0, startTop + deltaY);
                diceCover.style.top = currentNewTop + 'px';

                // Gradually reveal dice as cover is dragged - keep dice in place
                const revealPercent = Math.min(currentNewTop / 100, 1);
                const diceResult = document.getElementById('diceResult');
                diceResult.style.opacity = revealPercent;
                // Keep dice centered in bowl, don't scale or move them
                diceResult.style.transform = 'translate(-50%, -50%) scale(1)';
            };

            const handleMouseUp = async () => {
                this.diceCoverDragged = false;
                diceCover.classList.remove('dragging');
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);

                // Check if cover is dragged enough to reveal result
                // Use the actual dragged distance, not offsetTop
                const draggedDistance = currentNewTop - startTop;
                if (draggedDistance > 100) {
                    // Fully reveal dice and show result
                    const diceResult = document.getElementById('diceResult');
                    const diceResultDisplay = document.getElementById('diceResultDisplay');
                    const diceOutcome = document.getElementById('diceOutcome');

                    diceResult.style.opacity = '1';
                    diceResult.style.transform = 'translate(-50%, -50%) scale(1)';
                    diceCover.style.display = 'none';
                    this.diceCoverDraggable = false;

                    // Show result display outside the bowl
                    if (diceResultDisplay) {
                        diceResultDisplay.style.display = 'flex';
                    }

                    // Show outcome result
                    if (diceOutcome) {
                        const round = this.gameData.current_round;
                        diceOutcome.textContent = round.result.toUpperCase();
                        diceOutcome.className = `dice-outcome ${round.result}`;
                    }

                    // Show announcement and process winnings
                    this.showResultAnnouncement();
                    await this.processWinnings();
                    this.addToHistory();

                    // Update round status
                    this.gameData.current_round.status = "finished";

                    // Show new game button
                    this.showNewGameButton();

                    // Re-enable betting buttons for next round
                    setTimeout(() => {
                        document.getElementById('taiButton').disabled = false;
                        document.getElementById('xiuButton').disabled = false;
                    }, 3000);
                } else {
                    // Snap back with animation
                    diceCover.style.transition = 'top 0.3s ease';
                    // Reset dice cover position to center
                    diceCover.style.top = '50%';
                    diceCover.style.left = '50%';
                    diceCover.style.transform = 'translate(-50%, -50%)';
                    const diceResult = document.getElementById('diceResult');
                    diceResult.style.opacity = '0';
                    diceResult.style.transform = 'translate(-50%, -50%) scale(1)';
                    setTimeout(() => {
                        diceCover.style.transition = '';
                    }, 300);
                }
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        // Touch support for mobile
        diceCover.addEventListener('touchstart', (e) => {
            if (!this.diceCoverDraggable || !this.gameData || !this.gameData.current_round || this.gameData.current_round.status !== "revealing") return;

            e.preventDefault();
            this.diceCoverDragged = true;
            diceCover.classList.add('dragging');

            const startY = e.touches[0].clientY;
            // Get current position from computed style, not offsetTop
            const currentTop = parseInt(diceCover.style.top) || 0;
            const startTop = currentTop;
            let currentNewTop = startTop; // Track current position

            const handleTouchMove = (e) => {
                const deltaY = e.touches[0].clientY - startY;
                currentNewTop = Math.max(0, startTop + deltaY);
                diceCover.style.top = currentNewTop + 'px';

                // Gradually reveal dice as cover is dragged - keep dice in place
                const revealPercent = Math.min(currentNewTop / 100, 1);
                const diceResult = document.getElementById('diceResult');
                diceResult.style.opacity = revealPercent;
                // Keep dice centered in bowl, don't scale or move them
                diceResult.style.transform = 'translate(-50%, -50%) scale(1)';
            };

            const handleTouchEnd = async () => {
                this.diceCoverDragged = false;
                diceCover.classList.remove('dragging');
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);

                // Check if cover is dragged enough to reveal result
                // Use the actual dragged distance, not offsetTop
                const draggedDistance = currentNewTop - startTop;
                if (draggedDistance > 100) {
                    // Fully reveal dice and show result
                    const diceResult = document.getElementById('diceResult');
                    const diceResultDisplay = document.getElementById('diceResultDisplay');
                    const diceOutcome = document.getElementById('diceOutcome');

                    diceResult.style.opacity = '1';
                    diceResult.style.transform = 'translate(-50%, -50%) scale(1)';
                    diceCover.style.display = 'none';
                    this.diceCoverDraggable = false;

                    // Show result display outside the bowl
                    if (diceResultDisplay) {
                        diceResultDisplay.style.display = 'flex';
                    }

                    // Show outcome result
                    if (diceOutcome) {
                        const round = this.gameData.current_round;
                        diceOutcome.textContent = round.result.toUpperCase();
                        diceOutcome.className = `dice-outcome ${round.result}`;
                    }

                    // Show announcement and process winnings
                    this.showResultAnnouncement();
                    await this.processWinnings();
                    this.addToHistory();

                    // Update round status
                    this.gameData.current_round.status = "finished";

                    // Show new game button
                    this.showNewGameButton();

                    // Re-enable betting buttons for next round
                    setTimeout(() => {
                        document.getElementById('taiButton').disabled = false;
                        document.getElementById('xiuButton').disabled = false;
                    }, 3000);
                } else {
                    // Snap back with animation
                    diceCover.style.transition = 'top 0.3s ease';
                    // Reset dice cover position to center
                    diceCover.style.top = '50%';
                    diceCover.style.left = '50%';
                    diceCover.style.transform = 'translate(-50%, -50%)';
                    const diceResult = document.getElementById('diceResult');
                    diceResult.style.opacity = '0';
                    diceResult.style.transform = 'translate(-50%, -50%) scale(1)';
                    setTimeout(() => {
                        diceCover.style.transition = '';
                    }, 300);
                }
            };

            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        });
    }

    showNewGameButton() {
        const newGameSection = document.getElementById('newGameSection');
        if (newGameSection) {
            newGameSection.style.display = 'block';
        }
    }

    hideNewGameButton() {
        const newGameSection = document.getElementById('newGameSection');
        if (newGameSection) {
            newGameSection.style.display = 'none';
        }
    }

    async joinNewGame() {
        console.log('🎲 Joining new game...');

        // Disable button to prevent multiple clicks
        const button = document.querySelector('.new-game-button');
        if (button) {
            button.disabled = true;
            button.textContent = '🔄 Đang tham gia...';
        }

        try {
            // Reset API call flag to allow new API call
            this.hasCalledActiveApi = false;

            // First try to get active game
            let activeGame = null;
            try {
                this.hasCalledActiveApi = true;
                console.log('🔍 Checking for active game... (API call #4 - joinNewGame)');
                activeGame = await window.auth.getActiveTaiXiuGame();
                console.log('Active game found:', activeGame);
            } catch (error) {
                console.log('No active game found, will create new one');
            }

            if (activeGame) {
                // Join existing active game
                await this.joinExistingGame(activeGame);
            } else {
                // Start new game only if no active game exists
                await this.startNewGame();
            }

            // Hide the button
            this.hideNewGameButton();

        } catch (error) {
            console.error('Error joining new game:', error);
            this.showNotification('Lỗi khi tham gia ván mới!', 'error');

            // Re-enable button
            if (button) {
                button.disabled = false;
                button.textContent = '🎲 Tham Gia Ván Mới';
            }
        }
    }

    async joinExistingGame(gameData) {
        console.log('Joining existing game:', gameData);

        // Calculate remaining time: timestamp + 60 seconds - current time
        // Add 7 hours to UTC timestamp to convert to local time
        const utcTimestamp = new Date(gameData.timestamp);
        const localTimestamp = new Date(utcTimestamp.getTime() + 7 * 60 * 60 * 1000); // +7 hours
        const gameEndTime = new Date(localTimestamp.getTime() + 60 * 1000); // +60 seconds
        const now = new Date();
        const remaining = Math.max(0, Math.floor((gameEndTime - now) / 1000));

        console.log('Joining existing game:', {
            gameId: gameData.game_id,
            originalTimestamp: gameData.timestamp,
            localTimestamp: localTimestamp.toISOString(),
            gameEndTime: gameEndTime.toISOString(),
            currentTime: now.toISOString(),
            remaining: remaining
        });

        // If game is already finished or almost finished, don't join
        if (remaining <= 5) {
            console.log('Game is already finished or almost finished, will start new game instead');
            await this.startNewGame();
            return;
        }

        // Initialize game state with existing game data
        this.currentGame = gameData;
        this.initializeGameState(gameData, remaining);

        // Hide new game button
        this.hideNewGameButton();

        // Note: initializeGameState already calls startCountdown and startBettingUpdates
        // So we don't need to call them again here

        // Start game monitoring
        this.startGameLoop();

        this.showNotification('Đã tham gia ván hiện tại!', 'success');
    }

    async startNewGame() {
        console.log('Starting new game...');

        try {
            // First check if there's already an active game (only if we haven't called API yet)
            if (!this.hasCalledActiveApi) {
                try {
                    this.hasCalledActiveApi = true;
                    console.log('🔍 Checking for active game... (API call #5 - startNewGame)');
                    const activeGame = await window.auth.getActiveTaiXiuGame();
                    if (activeGame) {
                        console.log('Active game already exists, joining instead of starting new one:', activeGame);
                        await this.joinExistingGame(activeGame);
                        return;
                    }
                } catch (checkError) {
                    console.log('No active game found, proceeding to start new game');
                }
            }

            // Generate MD5 hash for new game
            const md5Hash = this.generateMD5Hash();

            // Start new game via API
            const newGame = await window.auth.startNewTaiXiuGame(md5Hash);
            console.log('New game started:', newGame);

            // Initialize game state
            this.currentGame = newGame;
            this.initializeGameState(newGame, 60); // 60 seconds countdown

            // Hide new game button
            this.hideNewGameButton();

            // Start game monitoring
            this.startGameLoop();

            this.showNotification('Ván mới đã bắt đầu!', 'success');
        } catch (error) {
            console.error('Error starting new game:', error);

            // Check if error is due to existing active game (only if we haven't called API yet)
            if (!this.hasCalledActiveApi && error.message && error.message.includes('There is already an active game')) {
                console.log('Active game exists, attempting to join...');
                try {
                    this.hasCalledActiveApi = true;
                    console.log('🔍 Checking for active game... (API call #6 - error handling in startNewGame)');
                    const activeGame = await window.auth.getActiveTaiXiuGame();
                    if (activeGame) {
                        console.log('Found active game, joining:', activeGame);
                        await this.joinExistingGame(activeGame);
                        return;
                    }
                } catch (checkError) {
                    console.error('Error checking for active game:', checkError);
                }
            }

            // Re-throw error to be handled by calling function
            throw error;
        }
    }

    // Load user statistics from API
    async loadUserStats() {
        try {
            const response = await window.auth.authenticatedRequest('https://homatabe-qx4o.onrender.com/taixiu/stats');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const stats = await response.json();
            console.log('User stats loaded:', stats);

            // Update stats display
            this.updateStatsDisplay(stats);

        } catch (error) {
            console.error('Error loading user stats:', error);
            // Don't show error to user, just use default values
        }
    }

    // Update stats display
    updateStatsDisplay(stats) {
        const totalGamesEl = document.getElementById('totalGames');
        const highestWinEl = document.getElementById('highestWin');
        const lastGameEl = document.getElementById('lastGame');
        const currentMoneyEl = document.getElementById('currentMoney');

        if (totalGamesEl) {
            totalGamesEl.textContent = stats.total_games || 0;
        }

        if (highestWinEl) {
            highestWinEl.textContent = `$${(stats.highest_win || 0).toLocaleString()}`;
        }

        if (lastGameEl) {
            if (stats.last_game) {
                const lastGameDate = new Date(stats.last_game);
                lastGameEl.textContent = lastGameDate.toLocaleString('vi-VN');
            } else {
                lastGameEl.textContent = 'Chưa có';
            }
        }

        if (currentMoneyEl) {
            currentMoneyEl.textContent = `$${(stats.current_money || 0).toLocaleString()}`;
        }
    }

    // Load game history from API
    async loadGameHistory(page = 1, limit = 10) {
        try {
            const response = await window.auth.authenticatedRequest(`https://homatabe-qx4o.onrender.com/taixiu/games?page=${page}&limit=${limit}&sort_by=timestamp&sort_order=desc`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Game history loaded:', data);

            // Update history display
            this.updateHistoryDisplay(data.games || []);

            // Update pagination
            this.updatePagination(page, data.games ? data.games.length : 0, limit);

        } catch (error) {
            console.error('Error loading game history:', error);
            this.showHistoryError();
        }
    }

    // Update history display
    updateHistoryDisplay(games) {
        console.log('📚 updateHistoryDisplay called with:', games);
        const gamesListEl = document.getElementById('gamesList');

        if (!gamesListEl) {
            console.error('❌ gamesList element not found');
            return;
        }

        if (!games || games.length === 0) {
            console.log('📭 No games to display, showing empty state');
            gamesListEl.innerHTML = `
                <div class="empty-state">
                    <h4>📭 Chưa có lịch sử</h4>
                    <p>Bạn chưa chơi ván nào hoặc chưa có dữ liệu</p>
                </div>
            `;
            return;
        }

        console.log(`📚 Displaying ${games.length} games`);
        try {
            gamesListEl.innerHTML = games.map((game, index) => this.createGameItemHTML(game, index)).join('');
            console.log('✅ History display updated successfully');
        } catch (error) {
            console.error('❌ Error updating history display:', error);
            this.showHistoryError();
        }
    }

    // Create HTML for a single game item
    createGameItemHTML(game, index = 0) {
        // Cộng thêm 7 tiếng cho timestamp
        const gameDate = new Date(new Date(game.timestamp).getTime() + 7 * 60 * 60 * 1000);

        // Tự động đặt end_time = timestamp + 60 giây
        const endDate = new Date(gameDate.getTime() + 60 * 1000);

        // Các ván từ ván thứ 2 trở đi đều có trạng thái hoàn thành
        const isFinished = index > 0 || game.is_finished;

        // Xác định kết quả dựa trên game_id hoặc result
        let resultClass = 'pending';
        let resultText = 'CHƯA XÁC ĐỊNH';

        if (game.result) {
            resultClass = game.result === 'tai' ? 'tai' : 'xiu';
            resultText = game.result.toUpperCase();
        } else if (isFinished) {
            // Nếu ván đã hoàn thành nhưng chưa có result, tạo kết quả giả
            const gameIdHash = game.game_id.split('_').pop();
            const hashNumber = parseInt(gameIdHash.substring(0, 2), 16);
            if (hashNumber % 2 === 0) {
                resultClass = 'tai';
                resultText = 'TÀI';
            } else {
                resultClass = 'xiu';
                resultText = 'XỈU';
            }
        }

        return `
            <div class="game-item">
                <div class="game-header">
                    <div class="game-id">${game.game_id}</div>
                    <div class="game-result ${resultClass}">${resultText}</div>
                </div>
                <div class="game-details">
                    <div class="game-detail">
                        <span class="game-detail-label">Thời gian bắt đầu:</span>
                        <span class="game-detail-value">${gameDate.toLocaleString('vi-VN')}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Thời gian kết thúc:</span>
                        <span class="game-detail-value">${endDate.toLocaleString('vi-VN')}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Tổng cược:</span>
                        <span class="game-detail-value">$${(game.total_bet_amount || 0).toLocaleString()}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Cược Tài:</span>
                        <span class="game-detail-value">$${(game.tai_bet_amount || 0).toLocaleString()}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Cược Xỉu:</span>
                        <span class="game-detail-value">$${(game.xiu_bet_amount || 0).toLocaleString()}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Số người chơi Tài:</span>
                        <span class="game-detail-value">${game.tai_bettors_count || 0}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Số người chơi Xỉu:</span>
                        <span class="game-detail-value">${game.xiu_bettors_count || 0}</span>
                    </div>
                    <div class="game-detail">
                        <span class="game-detail-label">Trạng thái:</span>
                        <span class="game-detail-value">${isFinished ? 'Hoàn thành' : 'Đang chơi'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Update pagination controls
    updatePagination(currentPage, itemCount, limit) {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const currentPageEl = document.getElementById('currentPage');

        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
        }

        if (nextBtn) {
            nextBtn.disabled = itemCount < limit;
        }

        if (currentPageEl) {
            currentPageEl.textContent = currentPage;
        }
    }

    // Show history error
    showHistoryError() {
        const gamesListEl = document.getElementById('gamesList');
        if (gamesListEl) {
            gamesListEl.innerHTML = `
                <div class="empty-state">
                    <h4>❌ Lỗi tải dữ liệu</h4>
                    <p>Không thể tải lịch sử game. Vui lòng thử lại sau.</p>
                </div>
            `;
        }
    }

    // Change page for history
    changePage(direction) {
        const currentPageEl = document.getElementById('currentPage');
        if (!currentPageEl) return;

        let currentPage = parseInt(currentPageEl.textContent) || 1;
        const newPage = currentPage + direction;

        if (newPage < 1) return;

        this.loadGameHistory(newPage, 10);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.taixiuGame = new TaiXiuGame();

    // Make test function globally available
    window.testResultStringConsistency = (resultString, iterations = 5) => {
        return window.taixiuGame.testResultStringConsistency(resultString, iterations);
    };
});

// Export functions for global access
window.placeBet = (type) => window.taixiuGame.placeBet(type);
window.setBetAmount = (amount) => window.taixiuGame.setBetAmount(amount);
window.setAllIn = () => window.taixiuGame.setAllIn();
window.copyMD5 = () => window.taixiuGame.copyMD5();
window.joinNewGame = () => window.taixiuGame.joinNewGame();
window.loadGameHistory = () => window.taixiuGame.loadGameHistory();
window.changePage = (direction) => window.taixiuGame.changePage(direction);
window.showSoiCauModal = () => window.taixiuGame.showSoiCauModal();
window.closeSoiCauModal = () => window.taixiuGame.closeSoiCauModal();
window.changePageSize = () => window.taixiuGame.changePageSize();
window.refreshChart = () => window.taixiuGame.refreshChart();
