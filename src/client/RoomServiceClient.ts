import axios, { AxiosInstance, AxiosResponse } from 'axios';
import assert from 'assert';
import {
  ResponseEnvelope,
  TownCreateRequest,
  TownCreateResponse,
  TownDeleteRequest,
  TownJoinRequest,
  TownJoinResponse,
  TownListResponse,
  TownUpdateRequest,
} from '../requestHandlers/CoveyRoomRequestHandlers';

export default class RoomServiceClient {
  private _axios: AxiosInstance;

  constructor(serviceURL: string) {
    this._axios = axios.create({
      baseURL: serviceURL,
    });
  }

  static unwrapOrThrowError<T>(response: AxiosResponse<ResponseEnvelope<T>>, ignoreResponse = false): T {
    if (response.data.isOK) {
      if (ignoreResponse) {
        return {} as T;
      }
      assert(response.data.response);
      return response.data.response;
    }
    throw new Error(`Error processing request: ${response.data.message}`);
  }

  async createRoom(requestData: TownCreateRequest): Promise<TownCreateResponse> {
    const responseWrapper = await this._axios.post<ResponseEnvelope<TownCreateResponse>>('/towns', requestData);
    return RoomServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async updateRoom(requestData: TownUpdateRequest): Promise<void> {
    const responseWrapper = await this._axios.patch<ResponseEnvelope<void>>(`/towns/${requestData.coveyTownID}`, requestData);
    RoomServiceClient.unwrapOrThrowError(responseWrapper, true);
  }

  async deleteRoom(requestData: TownDeleteRequest): Promise<void> {
    const responseWrapper = await this._axios.delete<ResponseEnvelope<void>>(`/towns/${requestData.coveyTownID}/${requestData.coveyTownPassword}`);
    RoomServiceClient.unwrapOrThrowError(responseWrapper, true);
  }

  async listRooms(): Promise<TownListResponse> {
    const responseWrapper = await this._axios.get<ResponseEnvelope<TownListResponse>>('/towns');
    return RoomServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async joinRoom(requestData: TownJoinRequest): Promise<TownJoinResponse> {
    const responseWrapper = await this._axios.post('/sessions', requestData);
    return RoomServiceClient.unwrapOrThrowError(responseWrapper);
  }

}
