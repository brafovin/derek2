// Network manager - Socket.io client
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.playerId = null;
    this.roomId = null;
    this.connected = false;
    this._moveThrottle = 0;
  }

  connect() {
    this.socket = io();

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    this.socket.on('joinedRoom', (data) => {
      this.playerId = data.playerId;
      this.roomId = data.roomState.id;
      this.game.onJoinedRoom(data);
    });

    this.socket.on('roomFull', () => {
      this.game.showMessage('⚠️ Raum ist voll!');
    });

    this.socket.on('playerJoined', (data) => {
      this.game.onPlayerJoined(data);
    });

    this.socket.on('playerLeft', (id) => {
      this.game.onPlayerLeft(id);
    });

    this.socket.on('gameStart', () => {
      this.game.startGame();
    });

    this.socket.on('playerMoved', (data) => {
      if (data.id !== this.playerId) {
        this.game.player.updateOtherPlayer(data.id, data);
      }
    });

    this.socket.on('grannyUpdate', (data) => {
      if (this.game.granny) {
        this.game.granny.setServerState(data);
        this.game.updateGrannyHUD(data);
      }
    });

    this.socket.on('playerDamaged', (data) => {
      if (data.id === this.playerId) {
        this.game.onPlayerDamaged(data.health);
      }
    });

    this.socket.on('playerKnockedOut', (data) => {
      if (data.id === this.playerId) {
        this.game.onKnockedOut(data.day, data.cause);
      } else {
        const cause = data.cause === 'trap' ? '🪤 Bärenfalle!' : '🪚 Kettensäge!';
        this.game.showMessage(`💀 Mitspieler K.O. durch ${cause} – Tag ${data.day}`, 3000, '#ff4400');
      }
    });

    this.socket.on('bearTrapDropped', (data) => {
      this.game.spawnBearTrap(data);
    });

    this.socket.on('bearTrapTriggered', (data) => {
      this.game.triggerBearTrap(data.trapId, data.playerId === this.playerId);
    });

    this.socket.on('playerWokeUp', (data) => {
      if (data.id === this.playerId) {
        this.game.onWokeUp(data.day, data.health);
      }
    });

    this.socket.on('itemPickedUp', (data) => {
      this.game.onItemPickedUp(data);
    });

    this.socket.on('itemPickedUpByOther', (data) => {
      this.game.onItemPickedUpByOther(data);
    });

    this.socket.on('plankRemoved', (data) => {
      this.game.onPlankRemoved(data.door);
    });

    this.socket.on('doorOpened', (data) => {
      this.game.onDoorOpened(data.door);
    });

    this.socket.on('playerHiding', (data) => {
      // Visual feedback for other players hiding
      const p = this.game.player.otherPlayers[data.id];
      if (p) p.mesh.visible = !data.hiding;
    });

    this.socket.on('playerCaught', (data) => {
      this.game.onPlayerCaught(data);
    });

    this.socket.on('playerEscaped', (data) => {
      this.game.showMessage(`🏃 ${data.name} ist entkommen!`);
    });

    this.socket.on('gameOver', (data) => {
      this.game.onGameOver(data);
    });
  }

  joinRoom(roomId, playerName) {
    if (!this.connected) return;
    this.socket.emit('joinRoom', { roomId, playerName });
  }

  sendMove(x, y, z, rotY) {
    if (!this.connected) return;
    this._moveThrottle++;
    if (this._moveThrottle % 3 !== 0) return; // throttle to ~20fps
    this.socket.emit('playerMove', { x, y, z, rotY });
  }

  makeNoise(x, z, volume) {
    if (!this.connected) return;
    this.socket.emit('makeNoise', { x, z, volume });
  }

  pickupItem(itemId) {
    if (!this.connected) return;
    this.socket.emit('pickupItem', { itemId });
  }

  useItem(itemType, targetId) {
    if (!this.connected) return;
    this.socket.emit('useItem', { itemId: itemType, targetId });
  }

  hide(spotId, hiding) {
    if (!this.connected) return;
    this.socket.emit('hide', { spotId, hiding });
  }

  playerEscaped() {
    if (!this.connected) return;
    this.socket.emit('playerEscaped');
  }
}
