#include <iostream>
#include <string>
#include <vector>
#include <pthread.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>

#define PORT 8080

int create_receiver()
{
    int server_socket_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (server_socket_fd < 0)
    {
        throw std::runtime_error("Error creating server socket");
    }
    struct sockaddr_in server_address;
    memset(&server_address, '\0', sizeof(server_address));
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(2000);
    server_address.sin_addr.s_addr = INADDR_ANY;

    int reuse_option = 1;
    if (setsockopt(server_socket_fd, SOL_SOCKET, SO_REUSEADDR, (const char *)&reuse_option, sizeof(int)) < 0)
    {
        throw std::runtime_error("Error setting socket options");
    }

    struct sockaddr *server_address_ptr = (struct sockaddr *)&server_address;
    if (bind(server_socket_fd, server_address_ptr, sizeof(server_address)) < 0)
    {
        std::string error_message = "Bind error number: " << std::to_string(errno);
        throw std::runtime_error(error_message);
    }
    return server_socket_fd;
}
