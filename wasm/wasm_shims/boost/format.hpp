#pragma once

// WASM-friendly boost::format replacement
// Uses standard string stream for basic formatting

#include <string>
#include <sstream>

namespace boost {
    class format {
    private:
        std::ostringstream stream;
        std::string format_str;
        
    public:
        explicit format(const std::string& fmt) : format_str(fmt) {}
        explicit format(const char* fmt) : format_str(fmt) {}
        
        template<typename T>
        format& operator%(const T& value) {
            // Simple replacement - in real usage, would need format parsing
            // For WASM, we'll use basic stream insertion
            stream << value;
            return *this;
        }
        
        std::string str() const {
            // For basic cases, just return the stream content
            // In full implementation, would apply format_str template
            std::string result = stream.str();
            return result.empty() ? format_str : result;
        }
        
        operator std::string() const {
            return str();
        }
    };
    
    // Basic format function for simple cases
    inline std::string str(const format& f) {
        return f.str();
    }
}