package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

const defaultDevelopmentOrigin = "http://localhost:3000"

func CORSAllowedOrigins() ([]string, error) {
	rawOrigins := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if rawOrigins == "" {
		if IsProduction() {
			return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS is required in production")
		}
		return []string{defaultDevelopmentOrigin}, nil
	}

	origins := strings.Split(rawOrigins, ",")
	allowedOrigins := make([]string, 0, len(origins))
	seen := make(map[string]struct{}, len(origins))

	for _, origin := range origins {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		if strings.Contains(origin, "*") {
			return nil, fmt.Errorf("CORS origin %q must not contain wildcards", origin)
		}

		parsed, err := url.Parse(origin)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return nil, fmt.Errorf("CORS origin %q must be an absolute http(s) origin", origin)
		}
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return nil, fmt.Errorf("CORS origin %q must use http or https", origin)
		}
		if parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
			return nil, fmt.Errorf("CORS origin %q must not include path, query, or fragment", origin)
		}
		if IsProduction() && parsed.Scheme != "https" {
			return nil, fmt.Errorf("CORS origin %q must use https in production", origin)
		}

		normalized := parsed.String()
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		allowedOrigins = append(allowedOrigins, normalized)
	}

	if len(allowedOrigins) == 0 {
		return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS must include at least one valid origin")
	}

	return allowedOrigins, nil
}
