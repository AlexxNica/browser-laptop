/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Controller view which manages the top level immutable state for the app

const React = require('react')
const Immutable = require('immutable')
const windowStore = require('../stores/windowStore')
const appStoreRenderer = require('../stores/appStoreRenderer')
const windowActions = require('../actions/windowActions')
const appActions = require('../actions/appActions')
const Main = require('./main')
const cx = require('../lib/classSet')
const {getPlatformStyles} = require('../../app/common/lib/platformUtil')
const alreadyPinnedTabIds = new Set()
const {currentWindowId} = require('../../app/renderer/currentWindow')

class Window extends React.Component {
  constructor (props) {
    super(props)
    // initialize appState from props
    // and then listen for updates
    this.appState = appStoreRenderer.state
    this.windowState = Immutable.fromJS(this.props.initWindowState) || windowStore.getState()
    this.state = {
      immutableData: {
        windowState: this.windowState,
        appState: this.appState
      }
    }
    if (this.props.initWindowState) {
      windowActions.setState(this.windowState)
    }

    this.onChange = this.onChange.bind(this)
    this.onAppStateChange = this.onAppStateChange.bind(this)
    windowStore.addChangeListener(this.onChange)
    appStoreRenderer.addChangeListener(this.onAppStateChange)
  }

  componentWillMount () {
    if (!this.props.initWindowState || this.props.initWindowState.frames.length === 0) {
      if (this.props.frames.length === 0) {
        appActions.tabCreateRequested({})
      } else {
        this.props.frames.forEach((frame, i) => {
          if (frame.guestInstanceId) {
            console.log('guestInstanceId is set for winodw init frame to:', frame.guestInstanceId, frame, currentWindowId)
            appActions.newWebContentsAdded(currentWindowId, frame)
            return
          }
          appActions.tabCreateRequested({
            url: frame.location,
            partitionNumber: frame.partitionNumber,
            isPrivate: frame.isPrivate,
            active: i === 0
          })
        })
      }
    }
  }

  render () {
    let classes = {}
    classes['windowContainer'] = true

    const platformClasses = getPlatformStyles()
    platformClasses.forEach((className) => {
      classes[className] = true
    })

    // Windows puts a 1px border around frameless window
    // For Windows 10, this defaults to blue. When window
    // becomes inactive it needs to change to gray.
    if (classes['win10']) {
      classes['inactive'] = !this.windowState.getIn(['ui', 'hasFocus'])
    }

    return <div id='windowContainer' className={cx(classes)} >
      <Main windowState={this.state.immutableData.windowState}
        appState={this.state.immutableData.appState} />
    </div>
  }

  componentWillUnmount () {
    windowStore.removeChangeListener(this.onChange)
    appStoreRenderer.removeChangeListener(this.onAppStateChange)
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextState.immutableData !== this.state.immutableData
  }

  onChange () {
    this.windowState = windowStore.getState()
    this.setState({
      immutableData: {
        windowState: this.windowState,
        appState: this.appState
      }
    })
  }

  onAppStateChange () {
    this.appState = appStoreRenderer.state
    this.setState({
      immutableData: {
        windowState: this.windowState,
        appState: this.appState
      }
    })

    if (!this.props.includePinnedSites) {
      return
    }

    const pinnedTabs = this.appState.get('tabs').filter(
      (tab) => tab.get('pinned') &&
        !alreadyPinnedTabIds.has(tab.get('guestInstanceId')))

    // const frames = this.windowState.get('frames')

    // Check for new pinned sites which we don't already know about
      /*
    pinnedTabs = pinnedTabs
      .filter((pinnedTab) => {
        return !frames.find((frame) => frame.get('pinnedLocation') &&
            // Compare to the original src of the pinned frame
            frame.get('pinnedLocation') === pinnedTab.get('url') &&
            (frame.get('partitionNumber') || 0) === (pinnedTab.get('partition') || 0))
      })
    */
    console.log('----------------pinnedTabs size:', pinnedTabs.size)
    pinnedTabs.forEach((pinnedTab) => {
      alreadyPinnedTabIds.add(pinnedTab.get('guestInstanceId'))
      appActions.tabCreateRequested({
        url: pinnedTab.get('url'),
        partition: pinnedTab.get('partition'),
        guestInstanceId: pinnedTab.get('guestInstanceId'),
        pinned: true
      }, false)
    })
    /*

    // Check for unpinned sites which should be closed
    const framesToClose = frames.filter((frame) =>
      frame.get('pinnedLocation') &&
      // Compare to the original src of the pinned frame
      !pinnedTabs.find((pinnedTab) => frame.get('pinnedLocation') === pinnedTab.get('url') &&
        (frame.get('partitionNumber') || 0) === (pinnedTab.get('partition') || 0)))
    framesToClose.forEach((frameProps) => windowActions.closeFrame(frames, frameProps, true))
    */
  }
}
Window.propTypes = { appState: React.PropTypes.object, frames: React.PropTypes.array, initWindowState: React.PropTypes.object }

module.exports = Window
