import dotenv from 'dotenv';
import Twilio from 'twilio';
import IVideoClient from './IVideoClient';

dotenv.config();

// 4 hours: each client will time out after 4 hours of video and need to refresh
const MAX_ALLOWED_SESSION_DURATION = 14400;

export default class TwilioVideo implements IVideoClient {
  private _twilioClient: Twilio.Twilio;

  private static _instance: TwilioVideo;

  private _twilioAccountSid: string;

  private _twilioApiKeySID: string;

  private _twilioApiKeySecret: string;

  constructor(twilioAccountSid: string,
    twilioAuthToken: string,
    twilioAPIKeySID: string,
    twilioAPIKeySecret: string) {
    this._twilioAccountSid = twilioAccountSid;
    this._twilioApiKeySID = twilioAPIKeySID;
    this._twilioApiKeySecret = twilioAPIKeySecret;
    this._twilioClient = Twilio(twilioAccountSid, twilioAuthToken);
  }

  public static getInstance(): TwilioVideo {
    if (!TwilioVideo._instance) {
      const twilioAccountSID = process.env.TWILIO_ACCOUNT_SID || 'ACdummy';
      const twilioAPIAuthToken = process.env.TWILIO_API_AUTH_TOKEN || 'dummy';
      const twilioAPIKeySID = process.env.TWILIO_API_KEY_SID || 'dummy';
      const twilioAPIKeySecret = process.env.TWILIO_API_KEY_SECRET || 'dummy';
      TwilioVideo._instance = new TwilioVideo(
        twilioAccountSID, twilioAPIAuthToken, twilioAPIKeySID, twilioAPIKeySecret,
      );
    }
    return TwilioVideo._instance;
  }

  async getTokenForRoom(coveyRoomID: string, clientIdentity: string): Promise<string> {
    const token = new Twilio.jwt.AccessToken(
      this._twilioAccountSid, this._twilioApiKeySID, this._twilioApiKeySecret, {
        ttl: MAX_ALLOWED_SESSION_DURATION,
      },
    );
    // eslint-disable-next-line
    // @ts-ignore this is missing from the typedef, but valid as per the docs...
    token.identity = clientIdentity;
    const videoGrant = new Twilio.jwt.AccessToken.VideoGrant({ room: coveyRoomID });
    token.addGrant(videoGrant);

    return token.toJwt();
  }
}
