import { nanoid } from 'nanoid';
import { Socket } from 'socket.io';
import { UserLocation } from '../CoveyTypes';
import CoveyRoomListener from '../types/CoveyRoomListener';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import TwilioVideo from './TwilioVideo';

export type CoveyRoomHandle = { coveyRoomID : string, coveyRoomPassword : string };
export type CoveyRoomListing = { coveyRoomID : string, friendlyName : string };

/**
 * An adapter between CoveyRoomController's event interface (CoveyRoomListener)
 * and the low-level network communication protocol
 *
 * @param socket the Socket object that we will use to communicate with the player
 */
function roomSocketAdapter(socket: Socket): CoveyRoomListener {
  return {
    onPlayerMoved(movedPlayer: Player) {
      socket.emit('playerMoved', movedPlayer);
    },
    onPlayerDisconnected(removedPlayer: Player) {
      socket.emit('playerDisconnect', removedPlayer);
    },
    onPlayerJoined(newPlayer: Player) {
      socket.emit('newPlayer', newPlayer);
    },
    onRoomDestroyed() {
      socket.emit('roomClosing');
      socket.disconnect(true);
    },
  };
}

export class CoveyRoom {

  private static _instances : CoveyRoom[] = [];

  private constructor(
    private _friendlyName : string,
    private _isPubliclyListed : boolean,
    private readonly _coveyRoomID : string,
    private readonly _coveyRoomPassword : string) {
    CoveyRoom._instances.push(this);
  }

  public get isPubliclyListed(): boolean {
    return this._isPubliclyListed;
  }

  public get occupancy(): number {
    return this._listeners.length;
  }

  public get friendlyName(): string { return this._friendlyName; }

  public get coveyRoomID(): string { return this._coveyRoomID; }

  public static findInstance(coveyRoomID : string) : CoveyRoom|undefined {
    return this._instances.find((r) => r.coveyRoomID === coveyRoomID);
  }

  public static createHandle(friendlyName : string, isPubliclyListed : boolean) : CoveyRoomHandle {
    const room = new CoveyRoom(friendlyName, isPubliclyListed, nanoid(12), nanoid(24));
    return {
      coveyRoomID : room.coveyRoomID,
      coveyRoomPassword : room._coveyRoomPassword,
    };
  }

  public static listRooms() : CoveyRoomListing[] {
    return CoveyRoom._instances
      .filter((r) => r._isPubliclyListed)
      .map(
        ({ coveyRoomID, friendlyName, occupancy }) =>
          ({
            coveyRoomID, friendlyName,
            currentOccupancy: occupancy,
            maximumOccupancy: 5,
          }));
  }

  public update(coveyRoomPassword : string, friendlyName? : string, isPubliclyListed? : boolean) : boolean {
    if (coveyRoomPassword !== this._coveyRoomPassword) return false;
    if (friendlyName !== undefined) {
      this._friendlyName = friendlyName;
    }
    if (isPubliclyListed !== undefined) {
      this._isPubliclyListed = isPubliclyListed;
    }
    return true;
  }

  private _videoClient = TwilioVideo.getInstance();

  private _listeners : CoveyRoomListener[] = [];

  private _sessions : PlayerSession[] = [];

  public async registerPlayer(newPlayer : Player) : Promise<PlayerSession> {
    const theSession = new PlayerSession(newPlayer);

    this._sessions.push(theSession);

    // Create a video token for this user to join this room
    theSession.videoToken = await this._videoClient.getTokenForRoom(this._coveyRoomID, newPlayer.id);
    return theSession;
  }

  public getPlayers() : Player[] {
    return this._sessions.map((s) => s.player);
  }

  public static connect(socket : Socket) : void {
    const { token:sessionToken, coveyRoomID } = socket.handshake.auth as { token: string; coveyRoomID: string };
    const room = CoveyRoom.findInstance(coveyRoomID);
    const session = room?._sessions.find((s) => s.sessionToken === sessionToken);
    if (!room || !session) {
      socket.disconnect(true);
      return;
    }

    room._listeners.forEach((listener) => listener.onPlayerJoined(session.player));

    const listener = roomSocketAdapter(socket);
    room._listeners.push(listener);

    socket.on('disconnect', () => {
      room.disconnect(session);
      room._listeners = room._listeners.filter((l) => l !== listener);
    });
    socket.on('playerMovement', (newLocation:UserLocation) => {
      session.player.updateLocation(newLocation);
      room._listeners.forEach((each) => each.onPlayerMoved(session.player));
    });
  }

  public disconnect(session : PlayerSession) : void {
    this._sessions = this._sessions.filter(s => s === session);
    this._listeners.map((l) => l.onPlayerDisconnected(session.player));
  }

  public delete(coveyRoomPassword : string) : boolean {
    if (coveyRoomPassword !== this._coveyRoomPassword) return false;
    CoveyRoom._instances = CoveyRoom._instances.filter((r) => r !== this);
    this._listeners.map((l) => l.onRoomDestroyed());
    this._listeners = [];
    this._sessions = [];
    return true;
  }

}
