/* For license and copyright information please see LEGAL file in repository */

Application.navigator = {
    activePage: null,

    poolByPath: {},
}

Application.ActivePage = function () { return this.navigator.activePage }

/** 
 * ActivatePage will route to the page!
 * @param {page} page
 * @param {pageState} state
 */
Application.ActivatePage = async function (page, state) {
    // Warn active page about routing occur and do what it want to do
    if (this.navigator.activePage) {
        const approveLeave = await this.navigator.activePage.Deactivate()
        if (!approveLeave) return
    }

    this.navigator.activePage = page
    this.history.newState(state)

    // Add page HTML & CSS to DOM
    // TODO::: not efficient below code
    pageStylesElement.innerHTML = page.CSS

    await page.ActivatePage(state)

    // Update page title with page full name in activeState and update some meta tags.
    // activeState data can be update in each ActivatePage method call.
    window.document.title = state.Title
    window.document.description.content = state.Description
    window.document.robots.content = page.Robots
    // Twitter card  https://developer.twitter.com/en/docs/tweets/optimize-with-cards/guides/getting-started.html
    // The Open Graph protocol https://www.ogp.me/
}

/**
 * ActivatePageByURL decode the given URL and will route to the desire page with desire state.
 * @param {string} url
 */
Application.ActivatePageByURL = async function (url) {
    const URI = new URL(url, window.location.href)

    let pagePath = URI.pathname
    // TODO::: accept / at end of URL at all?? duplicate page??
    if (pagePath.charAt(pagePath.length - 1) === '/') pagePath = pagePath.substring(0, pagePath.length - 1)

    switch (pagePath) {
        case PathLanding:
            const landingName = URI.searchParams.get("id")
            if (landingName) {
                this.navigator.LoadLanding(landingName)
            } else {
                this.ActivatePage(error404Page, null)
            }
            return
    }

    // Find requested app!
    const page = this.GetPageByPath(pagePath)
    if (!page) {
        // Requested page not exist
        this.ActivatePage(error404Page, null)
        return
    }

    const pageState = {
        Page: page,
        Title: page.Info.Name,
        Description: page.Info.Description,
        Fragment: URI.hash,
    }
    // Set pageState conditions same as parameters in URL
    for (let sp of URI.searchParams.entries()) {
        const conditionName = sp[0]
        const conditionValue = sp[1]
        if (conditionName === "hl"  // hl==hrefLanguage
            || conditionName === "title" // use in share URLs
            || conditionName === "utm_source"
            || conditionName === "utm_medium"
            || conditionName === "utm_campaign"
            || conditionName === "rd") { // rd==redirect
            pageState.Conditions[conditionName] = conditionValue
            continue
        }
        // check requested condition support by page and add to page state conditions by desire type!
        const acceptedConditionType = page.acceptedConditions[conditionName]
        switch (typeof acceptedConditionType) {
            case "string":
                pageState.Conditions[conditionName] = conditionValue.replaceAll(" ", "+") // TODO::: have problem with base64 in URL query!
                break
            case "number":
                pageState.Conditions[conditionName] = Number(conditionValue)
                break
            case "boolean":
                pageState.Conditions[conditionName] = true
                break
            case "undefined": // Requested page with desire condition not exist
                // TODO::: why not save page state in pages states chain.
                this.ActivatePage(error404Page, null)
                return
        }
    }

    await this.ActivatePage(page, pageState)
}

Application.navigator.LoadLanding = async function (landingName) {
    // push state into the history stack
    window.history.pushState({}, "", "/l?id=" + landingName)

    const lang = OS.User.ContentPreferences.Language.iso639_1 || Application.ContentPreferences.Language.iso639_1
    try {
        const res = await fetch('/l/' + landingName + "-" + lang + ".html")
        switch (res.status) {
            case 200:
                const htmlRes = await res.text()
                window.document.body.innerHTML = htmlRes
                window.document.title = landingName
                break
            case 404:
                Application.ActivatePage(error404Page, null)
                break
            default:
                Application.ActivatePage(error500Page, null)
        }
    } catch (err) {
        // TODO::: network error
    }
}

/**
 * 
 * Listeners
 * 
 */
function clickListener(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return

    const anchor = event.composedPath().find(n => n.tagName === 'A')
    if (!anchor || anchor.target || !anchor.href ||
        anchor.hasAttribute('download') ||
        anchor.getAttribute('rel') === 'external') return

    const goUrl = new URL(anchor.href)
    // don't pushState if the URL is for a different host! It also check for "mailto"!
    if (window.location.host !== goUrl.host) return

    // prevent the default link click
    event.preventDefault()

    // Don't act if requested page is same. It also prevent reload page in empty href.
    if (goUrl.href === window.location.href) return

    // Do routing instead of reload page!
    Application.ActivatePageByURL(goUrl.href)
}
window.addEventListener('click', clickListener, false)
// https://github.com/GoogleChromeLabs/page-lifecycle
// window.addEventListener('unload', clickListener, false)

function stateChangeListener(event) {
    // console.log(event)
    // prevent the default navigate
    event.preventDefault()

    // Do routing instead of reload page!
    Application.ActivatePageByURL(window.location.href)
}
window.addEventListener('popstate', stateChangeListener, false)
window.addEventListener('pushState', stateChangeListener, false)
