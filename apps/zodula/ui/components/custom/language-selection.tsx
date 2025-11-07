import { useState, useMemo } from "react";
import { useTranslation } from "../../hooks/use-translation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { popup } from "@/zodula/ui";
import { GlobeIcon } from "lucide-react";

// Language Selection Dialog Component
const LanguageSelectionDialog = ({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: (result?: string) => void;
  initialData?: {
    availableLanguages: Array<{ code?: string; name?: string; flag?: string }>;
    currentLanguage?: string;
    setLanguage: (language: string) => void;
    filterLanguages?: string[];
  };
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen || !initialData) return null;

  const { availableLanguages, currentLanguage, setLanguage, filterLanguages } =
    initialData;

  // Separate languages into matching and non-matching based on search query
  const { matchingLanguages, nonMatchingLanguages } = useMemo(() => {
    let languages = availableLanguages.filter((language) => {
      const code = language.code || "";
      return !filterLanguages || filterLanguages.includes(code);
    });

    if (!searchQuery.trim()) {
      return { matchingLanguages: languages, nonMatchingLanguages: [] };
    }

    const query = searchQuery.toLowerCase().trim();
    const matching: typeof languages = [];
    const nonMatching: typeof languages = [];

    languages.forEach((language) => {
      const matches =
        (language.name?.toLowerCase() || "").includes(query) ||
        (language.code?.toLowerCase() || "").includes(query);

      if (matches) {
        matching.push(language);
      } else {
        nonMatching.push(language);
      }
    });

    return { matchingLanguages: matching, nonMatchingLanguages: nonMatching };
  }, [availableLanguages, filterLanguages, searchQuery]);

  const handleLanguageSelect = (languageCode: string) => {
    setLanguage(languageCode);
    onClose(languageCode);
  };

  return (
    <div className="zd:flex zd:flex-col zd:h-full zd:gap-4 zd:w-[90vw] zd:max-w-md">
      {/* Search Input */}
      <div className="zd:flex-shrink-0">
        <Input
          type="search"
          placeholder="Search languages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="zd:w-full"
          autoFocus
        />
      </div>

      {/* Language Grid */}
      <div className="zd:flex-1 zd:overflow-y-auto zd:space-y-4">
        {/* Matching Languages */}
        {matchingLanguages.length > 0 && (
          <div className="zd:grid zd:grid-cols-2 md:zd:grid-cols-3 lg:zd:grid-cols-4 zd:gap-3">
            {matchingLanguages.map((language, index) => {
              const languageCode = language.code || "";
              const isSelected = currentLanguage === languageCode;
              return (
                <button
                  key={languageCode || `lang-${index}`}
                  onClick={() => handleLanguageSelect(languageCode)}
                  className={`
                                        zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2
                                        zd:p-4 zd:rounded-lg zd:border-2 zd:transition-all
                                        zd:hover:bg-gray-50 zd:hover:border-gray-300
                                        ${
                                          isSelected
                                            ? "zd:bg-blue-50 zd:border-blue-500 zd:text-blue-700"
                                            : "zd:border-gray-200 zd:text-gray-700"
                                        }
                                    `}
                >
                  <span className="zd:text-3xl zd:leading-none">
                    {language.flag}
                  </span>
                  <div className="zd:text-center">
                    <div className="zd:font-medium zd:text-sm">
                      {language.name}
                    </div>
                    <div className="zd:text-xs zd:text-gray-500 zd:mt-1">
                      {language.code?.toUpperCase()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Non-Matching Languages (shown in gray when searching) */}
        {nonMatchingLanguages.length > 0 && (
          <div className="zd:space-y-2">
            {searchQuery.trim() && (
              <div className="zd:text-xs zd:text-gray-400 zd:font-medium zd:uppercase zd:tracking-wide">
                Other Languages
              </div>
            )}
            <div className="zd:grid zd:grid-cols-2 md:zd:grid-cols-3 lg:zd:grid-cols-4 zd:gap-3">
              {nonMatchingLanguages.map((language, index) => {
                const languageCode = language.code || "";
                const isSelected = currentLanguage === languageCode;
                return (
                  <button
                    key={languageCode || `lang-${index}`}
                    onClick={() => handleLanguageSelect(languageCode)}
                    className={`
                                            zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2
                                            zd:p-4 zd:rounded-lg zd:border-2 zd:transition-all
                                            zd:opacity-50 zd:cursor-pointer
                                            ${
                                              isSelected
                                                ? "zd:bg-blue-50 zd:border-blue-500 zd:text-blue-700 zd:opacity-70"
                                                : "zd:border-gray-200 zd:text-gray-400 zd:bg-gray-50"
                                            }
                                        `}
                  >
                    <span className="zd:text-3xl zd:leading-none zd:opacity-60">
                      {language.flag}
                    </span>
                    <div className="zd:text-center">
                      <div className="zd:font-medium zd:text-sm zd:text-gray-400">
                        {language.name}
                      </div>
                      <div className="zd:text-xs zd:text-gray-400 zd:mt-1">
                        {language.code?.toUpperCase()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No languages found */}
        {matchingLanguages.length === 0 &&
          nonMatchingLanguages.length === 0 && (
            <div className="zd:text-center zd:text-gray-500 zd:py-8">
              No languages found
            </div>
          )}
      </div>
    </div>
  );
};

export const LanguageSelection = (props: { filterLanguages?: string[] }) => {
  const { availableLanguages, currentLanguage, setLanguage } = useTranslation();

  const handleOpenDialog = async () => {
    // Map availableLanguages to ensure code, name, and flag are string | undefined (not null)
    const mappedLanguages = availableLanguages.map((lang) => ({
      code: lang.code ?? undefined,
      name: lang.name ?? undefined,
      flag: lang.flag ?? undefined,
    }));

    await popup(
      LanguageSelectionDialog,
      {
        title: "Select Language",
        description: "Choose your preferred language",
      },
      {
        availableLanguages: mappedLanguages,
        currentLanguage,
        setLanguage,
        filterLanguages: props.filterLanguages,
      }
    );
  };

  return (
    <Button
      variant="outline"
      className="zd:flex zd:items-center zd:gap-2"
      onClick={handleOpenDialog}
      hideLoading
    >
      <GlobeIcon />
    </Button>
  );
};
