/**
 * QuizPoker Server - Socket.IO Game Server
 */
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Game, Player, Round } from "./domain";
import { logger } from "./utils/logger";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.PORT || 3001;

// Хранилище активных игр
const activeGames = new Map<string, Game>();

// Middleware для express
app.use(express.json());
app.use(express.static("public"));

// Базовый роут для проверки работы сервера
app.get("/", (req, res) => {
    res.json({
        message: "QuizPoker Server is running!",
        activeGames: activeGames.size,
        timestamp: new Date().toISOString(),
    });
});

app.get("/health", (req, res) => {
    res.json({ status: "OK", uptime: process.uptime() });
});

// Socket.IO обработчики
io.on("connection", (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Присоединение к игре
    socket.on(
        "join_game",
        (data: { gameId: string; playerId: string; playerName: string }) => {
            try {
                const { gameId, playerId, playerName } = data;

                // Создаем игру если её нет
                if (!activeGames.has(gameId)) {
                    const game = new Game();
                    activeGames.set(gameId, game);
                    logger.info(`Created new game: ${gameId}`);
                }

                const game = activeGames.get(gameId)!;

                // Добавляем игрока в игру
                if (!game.players.find((p) => p.id === playerId)) {
                    const player = new Player(playerId, playerName);
                    game.addPlayer(player);
                    logger.info(`Player ${playerName} joined game ${gameId}`);
                }

                // Присоединяем сокет к комнате игры
                socket.join(gameId);

                // Отправляем текущее состояние игры
                socket.emit("game_state", {
                    game: game.serialize(),
                    playerId,
                });

                // Уведомляем других игроков
                socket.to(gameId).emit("player_joined", {
                    playerId,
                    playerName,
                    playersCount: game.players.length,
                });
            } catch (error) {
                logger.error("Error joining game:", error);
                socket.emit("error", { message: "Failed to join game" });
            }
        }
    );

    // Игровые действия
    socket.on(
        "player_action",
        (data: { gameId: string; playerId: string; action: any }) => {
            try {
                const { gameId, playerId, action } = data;
                const game = activeGames.get(gameId);

                if (!game) {
                    socket.emit("error", { message: "Game not found" });
                    return;
                }

                const player = game.players.find((p) => p.id === playerId);
                if (!player) {
                    socket.emit("error", { message: "Player not found" });
                    return;
                }

                // Выполняем действие игрока
                game.handlePlayerAction(player, action);

                // Отправляем обновленное состояние всем игрокам
                io.to(gameId).emit("game_state", {
                    game: game.serialize(),
                    lastAction: { playerId, action },
                });

                logger.info(
                    `Player ${playerId} performed action ${action.type} in game ${gameId}`
                );
            } catch (error) {
                logger.error("Error handling player action:", error);
                socket.emit("error", { message: "Failed to process action" });
            }
        }
    );

    // Начать игру
    socket.on("start_game", (data: { gameId: string; playerId: string }) => {
        try {
            const { gameId, playerId } = data;
            const game = activeGames.get(gameId);

            if (!game) {
                socket.emit("error", { message: "Game not found" });
                return;
            }

            // Проверяем, что игрок может начать игру (например, первый игрок или создатель)
            game.startGame();

            // Уведомляем всех игроков о начале игры
            io.to(gameId).emit("game_started", {
                game: game.serialize(),
                startedBy: playerId,
            });

            logger.info(`Game ${gameId} started by player ${playerId}`);
        } catch (error) {
            logger.error("Error starting game:", error);
            socket.emit("error", { message: "Failed to start game" });
        }
    });

    // Отключение клиента
    socket.on("disconnect", () => {
        logger.info(`Client disconnected: ${socket.id}`);

        // Здесь можно добавить логику для обработки отключения игрока
        // например, пометить игрока как неактивного или удалить из игры
    });

    // Получить список активных игр
    socket.on("get_games", () => {
        const games = Array.from(activeGames.entries()).map(([id, game]) => ({
            id,
            playersCount: game.players.length,
            status: game.status,
            createdAt: game.createdAt,
        }));

        socket.emit("games_list", games);
    });
});

// Запуск сервера
server.listen(PORT, () => {
    logger.info(`🚀 QuizPoker Server is running on port ${PORT}`);
    logger.info(`📊 Game status endpoint: http://localhost:${PORT}/`);
    logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
        logger.info("Server closed");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down gracefully");
    server.close(() => {
        logger.info("Server closed");
        process.exit(0);
    });
});

export { io, activeGames };
