import assert from 'assert';
import {Socket} from 'socket.io';
import Player from '../types/Player';
import {CoveyRoomList} from '../CoveyTypes';
import {CoveyRoom} from '../lib/CoveyRoom';

/**
 * The format of a request to join a town in Covey.Town, as dispatched by the server middleware
 */
export interface TownJoinRequest {
  /** userName of the player that would like to join * */
  userName: string;
  /** ID of the room that the player would like to join * */
  coveyTownID: string;
}

/**
 * The format of a response to join a Town in Covey.Town, as returned by the handler to the server
 * middleware
 */
export interface TownJoinResponse {
  /** Unique ID that represents this player * */
  coveyUserID: string;
  /** Secret token that this player should use to authenticate
   * in future requests to this service * */
  coveySessionToken: string;
  /** Secret token that this player should use to authenticate
   * in future requests to the video service * */
  providerVideoToken: string;
  /** List of players currently in this room * */
  currentPlayers: Player[];
  /** Friendly name of this room * */
  friendlyName: string;
  /** Is this a private room? * */
  isPubliclyListed: boolean;
}

/**
 * Payload sent by client to create a town
 */
export interface TownCreateRequest {
  friendlyName: string;
  isPubliclyListed: boolean;
}

/**
 * Response from the server for a room create request
 */
export interface TownCreateResponse {
  coveyTownID: string;
  coveyTownPassword: string;
}

/**
 * Response from the server for a room list request
 */
export interface TownListResponse {
  towns: CoveyRoomList;
}

/**
 * Payload sent by the client to delete a room
 */
export interface TownDeleteRequest {
  coveyTownID: string;
  coveyTownPassword: string;
}

/**
 * Payload sent by the client to update a room.
 * N.B., JavaScript is terrible, so:
 * if(!isPubliclyListed) -> evaluates to true if the value is false OR undefined, use ===
 */
export interface TownUpdateRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  friendlyName?: string;
  isPubliclyListed?: boolean;
}

/**
 * Envelope that wraps any response from the server
 */
export interface ResponseEnvelope<T> {
  isOK: boolean;
  message?: string;
  response?: T;
}

/**
 * A handler to process a player's request to join a room. The flow is:
 *  1. Client makes a RoomJoinRequest, this handler is executed
 *  2. Client uses the sessionToken returned by this handler to make a subscription to the room,
 *  @see roomSubscriptionHandler for the code that handles that request.
 *
 * @param requestData an object representing the player's request
 */
export async function roomJoinHandler(requestData: TownJoinRequest): Promise<ResponseEnvelope<TownJoinResponse>> {
  const room = CoveyRoom.findInstance(requestData.coveyTownID);
  if (!room) {
    return {
      isOK: false,
      message: 'Error: No such room',
    };
  }

  const newPlayer = new Player(requestData.userName);
  const newSession = await room.registerPlayer(newPlayer);
  assert(newSession.videoToken);
  return {
    isOK: true,
    response: {
      coveyUserID: newPlayer.id,
      coveySessionToken: newSession.sessionToken,
      providerVideoToken: newSession.videoToken,
      currentPlayers: room.getPlayers(), // TODO check
      friendlyName: room.friendlyName,
      isPubliclyListed: room.isPubliclyListed,
    },
  };
}

export async function roomListHandler(): Promise<ResponseEnvelope<TownListResponse>> {
  return {
    isOK: true,
    response: { towns: CoveyRoom.listRooms() },
  };
}

export async function roomCreateHandler(requestData: TownCreateRequest): Promise<ResponseEnvelope<TownCreateResponse>> {
  if (requestData.friendlyName.length === 0) {
    return {
      isOK: false,
      message: 'FriendlyName must be specified',
    };
  }
  const handle = CoveyRoom.createHandle(requestData.friendlyName, requestData.isPubliclyListed);
  return {
    isOK: true,
    response: handle,
  };
}

export async function roomDeleteHandler(requestData: TownDeleteRequest): Promise<ResponseEnvelope<Record<string, null>>> {
  const room = CoveyRoom.findInstance(requestData.coveyTownID);
  if (!room) {
    return {
      isOK : false,
      message : 'No such room',
    };
  }
  const success = room.delete(requestData.coveyTownPassword);
  return {
    isOK: success,
    response: {},
  };
}

export async function roomUpdateHandler(requestData: TownUpdateRequest): Promise<ResponseEnvelope<Record<string, null>>> {
  const room = CoveyRoom.findInstance(requestData.coveyTownID);
  if (!room) {
    return {
      isOK : false,
      message : 'No such room',
    };
  }
  const success = room.update(requestData.coveyTownPassword, requestData.friendlyName, requestData.isPubliclyListed);
  return {
    isOK: success,
    message: (success ? undefined : 'Invalid password.'),
    response: {},
  };
}


/**
 * A handler to process a remote player's subscription to updates for a room
 *
 * @param socket the Socket object that we will use to communicate with the player
 */
export function roomSubscriptionHandler(socket: Socket): void {
  CoveyRoom.connect(socket);
}
