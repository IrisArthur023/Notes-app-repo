import { CollaboratorPeer, Role } from '../types';

export interface CollabEvents {
  onRoomState?: (collaborators: CollaboratorPeer[]) => void;
  onUserJoined?: (user: CollaboratorPeer) => void;
  onUserLeft?: (userId: string) => void;
  onCursorUpdate?: (userId: string, cursor: { line: number; ch: number }, selection?: { start: { line: number; ch: number }; end: { line: number; ch: number } }) => void;
  onTextChange?: (content: string, senderId: string, version: number) => void;
  onCommentAdded?: (comment: any) => void;
  onVersionCreated?: (version: any) => void;
  onRoleUpdated?: (userId: string, newRole: Role) => void;
  onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void;
}

export class CollabWebSocket {
  private ws: WebSocket | null = null;
  private docId: string;
  private user: { id: string; name: string; color: string; role: Role; avatar?: string };
  private events: CollabEvents;
  private reconnectTimer: any = null;
  private isExplicitlyClosed = false;
  private heartbeatTimer: any = null;

  constructor(
    docId: string,
    user: { id: string; name: string; color: string; role: Role; avatar?: string },
    events: CollabEvents
  ) {
    this.docId = docId;
    this.user = user;
    this.events = events;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.isExplicitlyClosed = false;
    this.events.onStatusChange?.('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.events.onStatusChange?.('connected');
        // Join the document room
        this.send({
          type: 'join',
          docId: this.docId,
          user: this.user,
          cursor: { line: 1, ch: 0 },
        });

        // Start client heartbeat
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'room_state':
              this.events.onRoomState?.(msg.collaborators);
              break;
            case 'user_joined':
              this.events.onUserJoined?.(msg.user);
              break;
            case 'user_left':
              this.events.onUserLeft?.(msg.userId);
              break;
            case 'cursor_update':
              this.events.onCursorUpdate?.(msg.userId, msg.cursor, msg.selection);
              break;
            case 'text_change':
              this.events.onTextChange?.(msg.content, msg.senderId, msg.version);
              break;
            case 'comment_added':
              this.events.onCommentAdded?.(msg.comment);
              break;
            case 'version_created':
              this.events.onVersionCreated?.(msg.version);
              break;
            case 'role_updated':
              this.events.onRoleUpdated?.(msg.userId, msg.newRole);
              break;
          }
        } catch (err) {
          console.error('[CollabWS] Parse message error:', err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.events.onStatusChange?.('disconnected');
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[CollabWS] Socket connection error:', err);
        this.ws?.close();
      };
    } catch (e) {
      console.error('[CollabWS] Init error:', e);
      this.scheduleReconnect();
    }
  }

  public sendCursor(cursor: { line: number; ch: number }, selection?: { start: { line: number; ch: number }; end: { line: number; ch: number } }): void {
    this.send({
      type: 'cursor_move',
      docId: this.docId,
      cursor,
      selection,
    });
  }

  public sendTextChange(content: string, version: number): void {
    this.send({
      type: 'text_change',
      docId: this.docId,
      content,
      senderId: this.user.id,
      version,
    });
  }

  public broadcastComment(comment: any): void {
    this.send({
      type: 'comment_added',
      docId: this.docId,
      comment,
    });
  }

  public broadcastVersion(version: any): void {
    this.send({
      type: 'version_created',
      docId: this.docId,
      version,
    });
  }

  public broadcastRoleChange(targetUserId: string, newRole: Role): void {
    this.send({
      type: 'role_updated',
      docId: this.docId,
      userId: targetUserId,
      newRole,
    });
  }

  public updateUser(user: { id: string; name: string; color: string; role: Role; avatar?: string }): void {
    this.user = user;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'join',
        docId: this.docId,
        user: this.user,
      });
    }
  }

  public switchDocument(newDocId: string): void {
    this.docId = newDocId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'join',
        docId: this.docId,
        user: this.user,
      });
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.events.onStatusChange?.('disconnected');
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, 2500);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
