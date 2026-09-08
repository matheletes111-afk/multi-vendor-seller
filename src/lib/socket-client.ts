import { io, Socket } from "socket.io-client"

let socketInstance: Socket | null = null

export function getSocketClient(): Socket {
  if (!socketInstance) {
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== "undefined"
        ? (isLocalhost ? `${window.location.protocol}//${window.location.hostname}:3001` : window.location.origin)
        : "http://localhost:3001")

    socketInstance = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"],
    })
  }

  return socketInstance
}
