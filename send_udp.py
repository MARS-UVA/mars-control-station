import socket
import struct
import time

UDP_IP = "127.0.0.1"
UDP_PORT = 2001

FEEDBACK_PACKET_LENGTH = 84

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)


def build_packet():
    # -----------------------------
    # HEADER (matches C++ udpHeader)
    # <BBHHHH> = 10 bytes
    # -----------------------------
    reserved = 0
    packet_type = 1
    packet_length = FEEDBACK_PACKET_LENGTH
    num_packets = 1
    batch_packet_count = 1
    crc = 0

    header = struct.pack(
        "<BBHHHH",
        reserved,
        packet_type,
        packet_length,
        num_packets,
        batch_packet_count,
        crc
    )

    # -----------------------------
    # PAYLOAD (84 bytes raw buffer)
    # -----------------------------
    payload = bytearray(FEEDBACK_PACKET_LENGTH)

    # Only front-left wheel current = 10.0
    # float32 little-endian at byte offset 0
    payload[0:4] = struct.pack("<f", 100.0)

    return header + payload


def send():
    seq = 0

    while True:
        packet = build_packet()
        sock.sendto(packet, (UDP_IP, UDP_PORT))

        print("sent packet", seq, "size:", len(packet))

        seq += 1
        time.sleep(0.1)


if __name__ == "__main__":
    send()