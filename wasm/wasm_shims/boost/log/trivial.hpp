#pragma once

#ifndef BOOST_LOG_TRIVIAL_HPP_INCLUDED_
#define BOOST_LOG_TRIVIAL_HPP_INCLUDED_

#include <ostream>

namespace boost {
namespace log {
namespace trivial {

enum severity_level {
    trace,
    debug,
    info,
    warning,
    error,
    fatal
};

class null_stream {
public:
    template <typename T>
    null_stream &operator<<(const T &) { return *this; }

    // Support std::ostream manipulators like std::endl.
    null_stream &operator<<(std::ostream &(*)(std::ostream &)) { return *this; }
};

inline null_stream &null_logger()
{
    static null_stream instance;
    return instance;
}

} // namespace trivial
} // namespace log
} // namespace boost

#define BOOST_LOG_TRIVIAL(level) ::boost::log::trivial::null_logger()

#endif // BOOST_LOG_TRIVIAL_HPP_INCLUDED_
